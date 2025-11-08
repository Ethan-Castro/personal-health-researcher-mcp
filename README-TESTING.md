# Health Research MCP - Testing Guide

## Overview

This MCP server provides 9 powerful tools for health and medical research across multiple databases and APIs.

## API Keys Configuration

The following API keys are configured in your `.env` file:

### Commercial Search/Scrape Providers
- **EXA_API_KEY**: Neural semantic search (✓ Configured)
- **PARALLEL_API_KEY**: Multi-hop synthesis search (✓ Configured)
- **FIRECRAWL_API_KEY**: Web scraping and content extraction (✓ Configured)

### Literature Database APIs
- **PUBMED_API_KEY**: PubMed/NCBI E-utilities (✓ Configured)
- **SPRINGER_API_KEY**: Nature/Springer journals (✓ Configured)

### Dedalus Integration
**API Key**: `dsk_live_de8a5ff4a153_1dd8ff0c5ef1126841188d123f8fb310`

> Note: Dedalus integration needs to be added to the server if not already present.

## Available Tools

### 1. **research_health_exa**
Neural semantic search for health research and papers via Exa
```json
{
  "query": "diabetes treatment",
  "category": "papers",
  "num_results": 10
}
```

### 2. **research_health_parallel**
Multi-hop synthesis for complex health queries via Parallel Search
```json
{
  "objective": "Compare effectiveness of different diabetes treatments",
  "context": "Focus on Type 2 diabetes",
  "max_results": 10
}
```

### 3. **scrape_health_content**
Extract content from health sites and journals via Firecrawl
```json
{
  "url": "https://pubmed.ncbi.nlm.nih.gov/...",
  "formats": ["markdown"],
  "crawl_subpages": false,
  "max_pages": 10
}
```

### 4. **search_pubmed**
Search PubMed and fetch records via E-utilities
```json
{
  "query": "covid-19 treatment",
  "max_results": 25,
  "date_range": {
    "start": "2023-01-01",
    "end": "2024-12-31"
  }
}
```

### 5. **get_pmc_fulltext**
Retrieve PMC Open Access full-text locations by PMCID
```json
{
  "pmcid": "PMC7845234"
}
```

### 6. **search_europepmc**
Search life sciences literature with Europe PMC
```json
{
  "query": "cancer immunotherapy",
  "limit": 25,
  "open_access_only": true
}
```

### 7. **search_preprints**
Retrieve preprints from bioRxiv or medRxiv
```json
{
  "query": "machine learning",
  "server": "medrxiv",
  "start_date": "2024-01-01",
  "end_date": "2024-12-31"
}
```

### 8. **search_plos**
Query PLOS journals (e.g., PLOS Medicine) via the PLOS API
```json
{
  "query": "hypertension",
  "journal": "PLOS Medicine",
  "rows": 25
}
```

### 9. **search_nature_springer**
Query Nature/Springer metadata and open-access content
```json
{
  "query": "alzheimer disease",
  "journal_filter": "Nature Medicine",
  "open_access_only": false,
  "rows": 25
}
```

## Running Tests

### Start the Server
```bash
# Option 1: Development mode
npm run dev

# Option 2: Production mode
npm run build
npm start
```

### Run Automated Tests
```bash
# Install dependencies if needed
npm install

# Run the comprehensive test suite
npx tsx test-mcp.ts
```

### Manual Testing with curl

#### 1. Initialize MCP Session
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "id": 1
  }'
```

#### 2. List Available Tools
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }'
```

#### 3. Call a Tool (Example: PubMed Search)
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "mcp-session-id: YOUR_SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_pubmed",
      "arguments": {
        "query": "diabetes treatment",
        "max_results": 5
      }
    },
    "id": 3
  }'
```

## Expected Responses

### Successful Tool Call
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"provider\":\"pubmed\",\"args\":{...},\"data\":{...}}"
      }
    ]
  }
}
```

### Error Response
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"error\":\"Error message here\"}"
      }
    ],
    "isError": true
  }
}
```

## Testing Strategy

1. **Public APIs (No Auth Required)**
   - Europe PMC ✓
   - bioRxiv/medRxiv preprints ✓
   - PLOS journals ✓
   - PubMed (basic access) ✓

2. **Authenticated APIs**
   - PubMed (enhanced) ✓
   - Nature/Springer ✓
   - Exa ✓
   - Parallel ✓
   - Firecrawl ✓

3. **Tool Coverage**
   - Search tools: 7/9
   - Content extraction: 2/9
   - Data synthesis: 1/9

## Troubleshooting

### Server Won't Start
- Check port 3000 is not in use: `lsof -i :3000`
- Verify all dependencies installed: `npm install`
- Check `.env` file exists with API keys

### API Key Errors
- Ensure `.env` file is in the project root
- Verify API keys are valid and not expired
- Check API rate limits haven't been exceeded

### Tool Call Failures
- Verify MCP session is initialized
- Check `mcp-session-id` header is included after initialization
- Ensure tool arguments match the schema

## Performance Notes

- PubMed: Rate limited to 3 requests/second (10 with API key)
- Europe PMC: No authentication required, generous rate limits
- Preprints: API has built-in pagination, max 100 results per call
- Commercial APIs: Rate limits vary by subscription tier

## Next Steps

1. Add Dedalus API integration to the server
2. Create integration tests for all 9 tools
3. Add error handling for rate limits
4. Implement caching for frequently requested data
5. Add health check endpoint

