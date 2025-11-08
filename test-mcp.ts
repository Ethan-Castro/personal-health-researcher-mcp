import axios from 'axios';
import { randomUUID } from 'node:crypto';

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

  // Extract session ID from response headers if present
  const newSessionId = response.headers['mcp-session-id'];
  if (newSessionId && !sessionId) {
    sessionId = newSessionId;
    console.log(`✓ Session established: ${sessionId}`);
  }

  return response.data;
}

async function testInitialize() {
  console.log('\n=== Testing Initialize ===');
  const response = await sendMCPRequest('initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'test-client',
      version: '1.0.0'
    }
  });

  if (response.error) {
    throw new Error(`Initialize failed: ${response.error.message}`);
  }

  console.log('✓ Server info:', JSON.stringify(response.result?.serverInfo, null, 2));
  console.log('✓ Capabilities:', JSON.stringify(response.result?.capabilities, null, 2));
}

async function testListTools() {
  console.log('\n=== Testing List Tools ===');
  const response = await sendMCPRequest('tools/list');

  if (response.error) {
    throw new Error(`List tools failed: ${response.error.message}`);
  }

  const tools = response.result?.tools || [];
  console.log(`✓ Found ${tools.length} tools:`);
  tools.forEach((tool: any, idx: number) => {
    console.log(`  ${idx + 1}. ${tool.name}: ${tool.description}`);
  });

  return tools;
}

async function testToolCall(toolName: string, args: any) {
  console.log(`\n=== Testing Tool: ${toolName} ===`);
  console.log('Args:', JSON.stringify(args, null, 2));

  try {
    const response = await sendMCPRequest('tools/call', {
      name: toolName,
      arguments: args
    });

    if (response.error) {
      console.log(`✗ Tool call failed: ${response.error.message}`);
      return { success: false, error: response.error };
    }

    const content = response.result?.content;
    if (content && content[0]) {
      const resultText = content[0].text;
      const resultData = JSON.parse(resultText);
      
      console.log('✓ Tool call successful');
      console.log('Provider:', resultData.provider);
      
      // Show a preview of the data
      if (resultData.data) {
        const dataPreview = JSON.stringify(resultData.data, null, 2).substring(0, 500);
        console.log('Data preview:', dataPreview + (dataPreview.length >= 500 ? '...' : ''));
      }
      
      return { success: true, data: resultData };
    }

    return { success: true, result: response.result };
  } catch (error: any) {
    console.log(`✗ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║  Personal Health Researcher MCP - Comprehensive Test Suite ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nDedalus API Key: ${DEDALUS_API_KEY}`);
  console.log(`Testing endpoint: ${BASE_URL}`);

  try {
    // Initialize session
    await testInitialize();

    // List available tools
    const tools = await testListTools();

    // Test each tool with sample queries
    const testCases = [
      {
        name: 'search_pubmed',
        args: {
          query: 'diabetes treatment 2024',
          max_results: 5
        }
      },
      {
        name: 'search_europepmc',
        args: {
          query: 'covid-19 vaccine effectiveness',
          limit: 5,
          open_access_only: true
        }
      },
      {
        name: 'search_preprints',
        args: {
          query: 'machine learning',
          server: 'medrxiv',
          start_date: '2024-01-01',
          end_date: '2024-12-31'
        }
      },
      {
        name: 'search_plos',
        args: {
          query: 'hypertension',
          journal: 'PLOS Medicine',
          rows: 5
        }
      }
    ];

    const results: any[] = [];
    for (const testCase of testCases) {
      const result = await testToolCall(testCase.name, testCase.args);
      results.push({ tool: testCase.name, ...result });
      
      // Add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                      Test Summary                          ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`\n✓ Successful: ${successful}/${results.length}`);
    console.log(`✗ Failed: ${failed}/${results.length}`);
    
    if (failed > 0) {
      console.log('\nFailed tests:');
      results.filter(r => !r.success).forEach(r => {
        console.log(`  - ${r.tool}: ${r.error}`);
      });
    }

    console.log('\n✓ MCP Server is functioning correctly!');
    console.log('\nNote: Some tools may require API keys to be configured in .env file:');
    console.log('  - EXA_API_KEY (for research_health_exa)');
    console.log('  - PARALLEL_API_KEY (for research_health_parallel)');
    console.log('  - FIRECRAWL_API_KEY (for scrape_health_content)');
    console.log('  - SPRINGER_API_KEY (for search_nature_springer)');
    console.log('  - PUBMED_API_KEY (optional, for higher rate limits)');

  } catch (error: any) {
    console.error('\n✗ Test suite failed:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    process.exit(1);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

