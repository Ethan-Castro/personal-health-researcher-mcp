import axios from 'axios';

const BASE_URL = 'http://localhost:3000/mcp';
const DEDALUS_API_KEY = 'dsk_live_de8a5ff4a153_1dd8ff0c5ef1126841188d123f8fb310';

interface MCPResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
  };
}

let sessionId: string | null = null;

async function sendMCPRequest(method: string, params?: any, id: string | number = 1): Promise<MCPResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream'
  };
  
  if (sessionId) {
    headers['mcp-session-id'] = sessionId;
  }

  const response = await axios.post(BASE_URL, {
    jsonrpc: '2.0',
    method,
    params: params || {},
    id
  }, { headers });

  const newSessionId = response.headers['mcp-session-id'];
  if (newSessionId && !sessionId) {
    sessionId = newSessionId;
  }

  return response.data;
}

async function testToolCall(toolName: string, args: any) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`Testing: ${toolName}`);
  console.log('='.repeat(70));
  console.log('Arguments:', JSON.stringify(args, null, 2));

  try {
    const response = await sendMCPRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    if (response.error) {
      console.log(`❌ FAILED: ${response.error.message}`);
      return { success: false, error: response.error };
    }

    const content = response.result?.content;
    if (content && content[0]) {
      const resultText = content[0].text;
      const resultData = JSON.parse(resultText);
      
      if (resultData.error) {
        console.log(`❌ FAILED: ${resultData.error}`);
        if (resultData.meta) {
          console.log('Details:', resultData.meta);
        }
        return { success: false, error: resultData.error };
      }

      console.log('✅ SUCCESS');
      console.log('Provider:', resultData.provider);
      
      // Show detailed results
      if (resultData.data) {
        if (resultData.data.results || resultData.data.resultList) {
          const results = resultData.data.results || resultData.data.resultList?.result || [];
          console.log(`Results count: ${results.length || 'N/A'}`);
        }
        if (resultData.data.count !== undefined) {
          console.log(`Total count: ${resultData.data.count}`);
        }
        if (resultData.data.hitCount !== undefined) {
          console.log(`Hit count: ${resultData.data.hitCount}`);
        }
        if (resultData.data.collection) {
          console.log(`Collection size: ${resultData.data.collection.length}`);
        }
        if (resultData.data.response?.numFound !== undefined) {
          console.log(`Total found: ${resultData.data.response.numFound}`);
        }
        
        // Show first result if available
        const firstResult = 
          resultData.data.results?.[0] || 
          resultData.data.resultList?.result?.[0] ||
          resultData.data.collection?.[0] ||
          resultData.data.response?.docs?.[0];
        
        if (firstResult) {
          console.log('\nFirst result:');
          console.log('  Title:', firstResult.title || firstResult.ArticleTitle || firstResult.Title || 'N/A');
          console.log('  Authors:', firstResult.authors || firstResult.authorString || 'N/A');
        }
      }
      
      return { success: true, data: resultData };
    }

    return { success: true, result: response.result };
  } catch (error: any) {
    console.log(`❌ ERROR: ${error.message}`);
    if (error.response?.data) {
      console.log('Response:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║     Personal Health Researcher MCP - COMPLETE TOOL TEST SUITE    ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝');
  console.log(`\n🔑 Dedalus API Key: ${DEDALUS_API_KEY}`);
  console.log(`🌐 Testing endpoint: ${BASE_URL}\n`);

  try {
    // Initialize
    console.log('Initializing MCP session...');
    await sendMCPRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'comprehensive-test-client', version: '1.0.0' }
    });
    console.log('✅ Session initialized:', sessionId);

    // List tools
    const toolsResponse = await sendMCPRequest('tools/list');
    const tools = toolsResponse.result?.tools || [];
    console.log(`\n📋 Found ${tools.length} tools to test\n`);

    // Define comprehensive test cases for all 9 tools
    const testCases = [
      // Tool 1: EXA Neural Search
      {
        name: 'research_health_exa',
        args: {
          query: 'latest advances in cancer immunotherapy research',
          type: 'neural',
          num_results: 5
        }
      },
      
      // Tool 2: Parallel Multi-hop Search
      {
        name: 'research_health_parallel',
        args: {
          objective: 'Find comprehensive research on the effectiveness of mRNA vaccines for COVID-19 variants',
          context: 'Focus on peer-reviewed studies from 2023-2024',
          max_results: 5
        }
      },
      
      // Tool 3: Firecrawl Web Scraping
      {
        name: 'scrape_health_content',
        args: {
          url: 'https://www.who.int/news-room/fact-sheets/detail/cardiovascular-diseases-(cvds)',
          formats: ['markdown'],
          crawl_subpages: false,
          max_pages: 1
        }
      },
      
      // Tool 4: PubMed Search
      {
        name: 'search_pubmed',
        args: {
          query: 'Alzheimer disease biomarkers',
          max_results: 10,
          date_range: {
            start: '2023/01/01',
            end: '2024/12/31'
          }
        }
      },
      
      // Tool 5: PMC Full Text
      {
        name: 'get_pmc_fulltext',
        args: {
          pmcid: 'PMC7845234'
        }
      },
      
      // Tool 6: Europe PMC
      {
        name: 'search_europepmc',
        args: {
          query: 'CRISPR gene therapy clinical trials',
          limit: 10,
          open_access_only: true
        }
      },
      
      // Tool 7: Preprints (medRxiv)
      {
        name: 'search_preprints',
        args: {
          query: 'artificial intelligence radiology',
          server: 'medrxiv',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        }
      },
      
      // Tool 8: PLOS Journals
      {
        name: 'search_plos',
        args: {
          query: 'obesity and metabolic syndrome',
          journal: 'PLOS Medicine',
          rows: 10
        }
      },
      
      // Tool 9: Nature/Springer
      {
        name: 'search_nature_springer',
        args: {
          query: 'neuroplasticity brain injury',
          open_access_only: false,
          rows: 10
        }
      }
    ];

    const results: any[] = [];
    
    for (const testCase of testCases) {
      const result = await testToolCall(testCase.name, testCase.args);
      results.push({ tool: testCase.name, ...result });
      
      // Add delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    // Generate detailed summary
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                        COMPREHENSIVE SUMMARY                      ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    console.log(`Success rate: ${((successful.length / results.length) * 100).toFixed(1)}%`);
    
    // Group by category
    console.log('\n📊 Results by Category:\n');
    
    const categories = {
      'Commercial APIs': ['research_health_exa', 'research_health_parallel', 'scrape_health_content'],
      'Public Literature DBs': ['search_pubmed', 'get_pmc_fulltext', 'search_europepmc', 'search_preprints'],
      'Journal APIs': ['search_plos', 'search_nature_springer']
    };

    for (const [category, toolNames] of Object.entries(categories)) {
      console.log(`${category}:`);
      toolNames.forEach(toolName => {
        const result = results.find(r => r.tool === toolName);
        if (result) {
          const status = result.success ? '✅' : '❌';
          console.log(`  ${status} ${toolName}`);
        }
      });
      console.log('');
    }
    
    if (failed.length > 0) {
      console.log('❌ Failed Tests Details:\n');
      failed.forEach(r => {
        console.log(`  Tool: ${r.tool}`);
        console.log(`  Error: ${JSON.stringify(r.error)}`);
        console.log('');
      });
    }

    console.log('\n💡 Notes:');
    console.log('  - All API keys are configured in .env');
    console.log('  - PubMed, Europe PMC, Preprints, and PLOS work without authentication');
    console.log('  - Commercial APIs (Exa, Parallel, Firecrawl) require valid API keys');
    console.log('  - Springer Nature requires an API key from their developer portal');
    console.log(`  - Dedalus API key available: ${DEDALUS_API_KEY}`);
    
    console.log('\n🎉 Test suite completed!\n');
    
    process.exit(failed.length === 0 ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

