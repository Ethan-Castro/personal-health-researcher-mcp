import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest, type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

const ok = <T>(data: T): CallToolResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  structuredContent: { data } as Record<string, unknown>
});

const err = (message: string, meta?: unknown): CallToolResult => ({
  content: [{ type: 'text' as const, text: JSON.stringify({ error: message, meta }, null, 2) }],
  structuredContent: { error: message, meta } as Record<string, unknown>,
  isError: true
});

const EXA_API_KEY = process.env.EXA_API_KEY || '';
const EXA_API_URL = process.env.EXA_API_URL || 'https://api.exa.ai/search';

const PARALLEL_API_KEY = process.env.PARALLEL_API_KEY || '';
const PARALLEL_API_URL = process.env.PARALLEL_API_URL || 'https://platform.parallel.ai/api/search';

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY || '';
const FIRECRAWL_BASE = process.env.FIRECRAWL_BASE || 'https://api.firecrawl.dev/v1';

const PUBMED_API_KEY = process.env.PUBMED_API_KEY || '';
const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const EUROPE_PMC_BASE = 'https://www.ebi.ac.uk/europepmc/webservices/rest';

const SPRINGER_API_KEY = process.env.SPRINGER_API_KEY || '';
const SPRINGER_META_BASE = process.env.SPRINGER_META_BASE || 'https://api.springernature.com/meta/v2/json';
const SPRINGER_OA_BASE = process.env.SPRINGER_OA_BASE || 'https://api.springernature.com/openaccess/json';

const exaSchema = z.object({
  query: z.string(),
  category: z.enum(['papers', 'research', 'company']).default('papers'),
  num_results: z.number().int().min(1).max(50).default(10)
});
const exaInputShape = exaSchema.shape;

const parallelSchema = z.object({
  objective: z.string(),
  context: z.string().optional(),
  max_results: z.number().int().min(1).max(50).default(10)
});
const parallelInputShape = parallelSchema.shape;

const firecrawlSchema = z.object({
  url: z.string().url(),
  formats: z.array(z.enum(['markdown', 'html', 'links'])).default(['markdown']),
  crawl_subpages: z.boolean().default(false),
  max_pages: z.number().int().min(1).max(200).default(10)
});
const firecrawlInputShape = firecrawlSchema.shape;

const pubmedSchema = z.object({
  query: z.string(),
  max_results: z.number().int().min(1).max(200).default(25),
  date_range: z
    .object({
      start: z.string().optional(),
      end: z.string().optional()
    })
    .optional()
});
const pubmedInputShape = pubmedSchema.shape;

const pmcFulltextSchema = z.object({
  pmcid: z.string()
});
const pmcFulltextInputShape = pmcFulltextSchema.shape;

const europePmcSchema = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(200).default(25),
  open_access_only: z.boolean().default(false)
});
const europePmcInputShape = europePmcSchema.shape;

const preprintsSchema = z.object({
  query: z.string().optional(),
  server: z.enum(['biorxiv', 'medrxiv']).default('medrxiv'),
  start_date: z.string().default('2024-01-01'),
  end_date: z.string().default('2025-12-31')
});
const preprintsInputShape = preprintsSchema.shape;

const plosSchema = z.object({
  query: z.string(),
  journal: z
    .enum(['PLOS Medicine', 'PLOS Biology', 'PLOS ONE', 'PLOS Genetics', 'PLOS Computational Biology'])
    .default('PLOS Medicine'),
  rows: z.number().int().min(1).max(100).default(25)
});
const plosInputShape = plosSchema.shape;

const springerSchema = z.object({
  query: z.string(),
  journal_filter: z.string().optional(),
  open_access_only: z.boolean().default(false),
  rows: z.number().int().min(1).max(100).default(25)
});
const springerInputShape = springerSchema.shape;

async function httpGet(url: string, headers?: Record<string, string>) {
  const res = await axios.get(url, { headers, timeout: 30000 });
  return res.data;
}

async function httpPost(url: string, data: any, headers?: Record<string, string>) {
  const res = await axios.post(url, data, { headers, timeout: 60000 });
  return res.data;
}

async function exaSearch(query: string, category: string, num: number) {
  if (!EXA_API_KEY) throw new Error('Missing EXA_API_KEY');
  const payload = { query, type: category, num_results: num, text: true };
  return await httpPost(EXA_API_URL, payload, { Authorization: `Bearer ${EXA_API_KEY}` });
}

async function parallelSearch(objective: string, context?: string, max_results = 10) {
  if (!PARALLEL_API_KEY) throw new Error('Missing PARALLEL_API_KEY');
  const payload = { objective, context, max_results };
  return await httpPost(PARALLEL_API_URL, payload, { Authorization: `Bearer ${PARALLEL_API_KEY}` });
}

async function firecrawlScrape(url: string, formats: string[], crawl: boolean, max_pages: number) {
  if (!FIRECRAWL_API_KEY) throw new Error('Missing FIRECRAWL_API_KEY');
  if (crawl) {
    return await httpPost(
      `${FIRECRAWL_BASE}/crawl`,
      { url, includeSubdomains: false, maxDepth: 1, maxPages: max_pages, formats },
      { Authorization: `Bearer ${FIRECRAWL_API_KEY}` }
    );
  }
  return await httpPost(
    `${FIRECRAWL_BASE}/scrape`,
    { url, formats },
    { Authorization: `Bearer ${FIRECRAWL_API_KEY}` }
  );
}

async function pubmedSearchAndFetch(
  query: string,
  max_results: number,
  date_range?: { start?: string; end?: string }
) {
  const params = new URLSearchParams({
    db: 'pubmed',
    term: query,
    retmode: 'json',
    retmax: String(max_results)
  });
  if (PUBMED_API_KEY) params.set('api_key', PUBMED_API_KEY);
  if (date_range?.start || date_range?.end) {
    params.set('mindate', date_range.start || '1900');
    params.set('maxdate', date_range.end || '3000');
    params.set('datetype', 'pdat');
  }
  const esearch = await httpGet(`${EUTILS_BASE}/esearch.fcgi?${params.toString()}`);
  const ids: string[] = esearch.esearchresult?.idlist || [];
  if (ids.length === 0) return { count: 0, results: [] };

  const efetchParams = new URLSearchParams({
    db: 'pubmed',
    id: ids.join(','),
    retmode: 'xml'
  });
  if (PUBMED_API_KEY) efetchParams.set('api_key', PUBMED_API_KEY);

  const xml = await httpGet(`${EUTILS_BASE}/efetch.fcgi?${efetchParams.toString()}`);
  return { count: ids.length, pmids: ids, xml };
}

async function pmcFullTextLinks(pmcid: string) {
  const url = `https://www.ncbi.nlm.nih.gov/pmc/utils/oa/oa.fcgi?id=${encodeURIComponent(pmcid)}`;
  return await httpGet(url);
}

async function europePmcSearch(query: string, limit: number, oaOnly: boolean) {
  const params = new URLSearchParams({
    query,
    format: 'json',
    pageSize: String(limit)
  });
  if (oaOnly) params.set('openAccess', 'y');
  return await httpGet(`${EUROPE_PMC_BASE}/search?${params.toString()}`);
}

async function preprintsSearch(server: 'biorxiv' | 'medrxiv', start: string, end: string, query?: string) {
  const url = `https://api.biorxiv.org/details/${server}/${start}/${end}`;
  const data = await httpGet(url);
  if (!query) return data;
  const q = query.toLowerCase();
  data.collection = (data.collection || []).filter(
    (r: any) =>
      String(r.title || '').toLowerCase().includes(q) ||
      String(r.abstract || '').toLowerCase().includes(q) ||
      String(r.category || '').toLowerCase().includes(q)
  );
  return data;
}

async function plosSearch(query: string, journal: string, rows: number) {
  const params = new URLSearchParams({
    q: query,
    fq: `journal:"${journal}"`,
    wt: 'json',
    rows: String(rows)
  });
  return await httpGet(`http://api.plos.org/search?${params.toString()}`);
}

async function springerSearch(query: string, journal?: string, oaOnly?: boolean, rows = 25) {
  if (!SPRINGER_API_KEY) throw new Error('Missing SPRINGER_API_KEY');
  const base = oaOnly ? SPRINGER_OA_BASE : SPRINGER_META_BASE;
  const params = new URLSearchParams({
    q: journal ? `${query} AND journal:"${journal}"` : query,
    api_key: SPRINGER_API_KEY,
    p: String(rows)
  });
  return await httpGet(`${base}?${params.toString()}`);
}

function createServer() {
  const server = new McpServer({
    name: 'personal-health-research-mcp',
    version: '1.0.0'
  });

  server.registerTool(
    'research_health_exa',
    {
      title: 'Research Health Topics with Exa',
      description: 'Neural semantic search for health research and papers via Exa',
      inputSchema: exaInputShape
    },
    async (input) => {
      try {
        const args = exaSchema.parse(input);
        const data = await exaSearch(args.query, args.category, args.num_results);
        return ok({ provider: 'exa', args, data, provenance: { url: EXA_API_URL } });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'research_health_parallel',
    {
      title: 'Deep Health Research with Parallel',
      description: 'Multi-hop synthesis for complex health queries via Parallel Search',
      inputSchema: parallelInputShape
    },
    async (input) => {
      try {
        const args = parallelSchema.parse(input);
        const data = await parallelSearch(args.objective, args.context, args.max_results);
        return ok({ provider: 'parallel', args, data, provenance: { url: PARALLEL_API_URL } });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'scrape_health_content',
    {
      title: 'Scrape Health Websites',
      description: 'Extract content from health sites and journals via Firecrawl',
      inputSchema: firecrawlInputShape
    },
    async (input) => {
      try {
        const args = firecrawlSchema.parse(input);
        const data = await firecrawlScrape(args.url, args.formats, args.crawl_subpages, args.max_pages);
        return ok({ provider: 'firecrawl', args, data });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'search_pubmed',
    {
      title: 'Search PubMed',
      description: 'Search PubMed and fetch records via E-utilities',
      inputSchema: pubmedInputShape
    },
    async (input) => {
      try {
        const args = pubmedSchema.parse(input);
        const data = await pubmedSearchAndFetch(args.query, args.max_results, args.date_range);
        return ok({ provider: 'pubmed', args, data, provenance: { base: EUTILS_BASE } });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'get_pmc_fulltext',
    {
      title: 'PMC Full Text Links',
      description: 'Retrieve PMC Open Access full-text locations by PMCID',
      inputSchema: pmcFulltextInputShape
    },
    async (input) => {
      try {
        const args = pmcFulltextSchema.parse(input);
        const data = await pmcFullTextLinks(args.pmcid);
        return ok({ provider: 'pmc', args, data });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'search_europepmc',
    {
      title: 'Search Europe PMC',
      description: 'Search life sciences literature with Europe PMC',
      inputSchema: europePmcInputShape
    },
    async (input) => {
      try {
        const args = europePmcSchema.parse(input);
        const data = await europePmcSearch(args.query, args.limit, args.open_access_only);
        return ok({ provider: 'europepmc', args, data, provenance: { base: EUROPE_PMC_BASE } });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'search_preprints',
    {
      title: 'Search bioRxiv/medRxiv Preprints',
      description: 'Retrieve preprints from bioRxiv or medRxiv',
      inputSchema: preprintsInputShape
    },
    async (input) => {
      try {
        const args = preprintsSchema.parse(input);
        const data = await preprintsSearch(args.server, args.start_date, args.end_date, args.query);
        return ok({ provider: args.server, args, data });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'search_plos',
    {
      title: 'Search PLOS Journals',
      description: 'Query PLOS journals (e.g., PLOS Medicine) via the PLOS API',
      inputSchema: plosInputShape
    },
    async (input) => {
      try {
        const args = plosSchema.parse(input);
        const data = await plosSearch(args.query, args.journal, args.rows);
        return ok({ provider: 'plos', args, data, provenance: { base: 'http://api.plos.org' } });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  server.registerTool(
    'search_nature_springer',
    {
      title: 'Search Nature/Springer',
      description: 'Query Nature/Springer metadata and open-access content via Springer APIs',
      inputSchema: springerInputShape
    },
    async (input) => {
      try {
        const args = springerSchema.parse(input);
        const data = await springerSearch(args.query, args.journal_filter, args.open_access_only, args.rows);
        return ok({ provider: 'springer_nature', args, data });
      } catch (e: any) {
        return err(e.message);
      }
    }
  );

  return server;
}

type SessionEntry = {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, SessionEntry>();

const app = express();
app.use(express.json({ limit: '2mb' }));

app.post('/mcp', async (req: Request, res: Response) => {
  try {
    const headerValue = req.headers['mcp-session-id'];
    const incomingSessionId = Array.isArray(headerValue) ? headerValue[0] : headerValue;

    if (incomingSessionId) {
      const existing = sessions.get(incomingSessionId);
      if (!existing) {
        res.status(404).json({
          jsonrpc: '2.0',
          error: { code: -32001, message: 'Unknown MCP session. Reinitialize required.' },
          id: null
        });
        return;
      }
      await existing.transport.handleRequest(req, res, req.body);
      return;
    }

    if (!isInitializeRequest(req.body)) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32600, message: 'Expected initialize request to start a new MCP session.' },
        id: null
      });
      return;
    }

    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId) => {
        sessions.set(sessionId, { server, transport });
      },
      onsessionclosed: (sessionId) => {
        const session = sessions.get(sessionId);
        if (session) {
          sessions.delete(sessionId);
          void session.transport.close();
          void session.server.close();
        }
      }
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: { code: -32603, message: 'Internal server error' },
        id: null
      });
    }
  }
});

const port = parseInt(process.env.PORT || '3000', 10);
app.listen(port, () => {
  console.log(`Health Research MCP running on http://localhost:${port}/mcp`);
});
