import axios from 'axios';

const BASE_URL = 'http://localhost:3000/mcp';

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
  console.log(`🧪 Testing: ${toolName}`);
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
          console.log('Error details:', JSON.stringify(resultData.meta, null, 2));
        }
        return { success: false, error: resultData.error };
      }

      console.log('✅ SUCCESS!');
      console.log('Provider:', resultData.provider);
      
      // Show data preview
      if (resultData.data) {
        if (resultData.data.results) {
          console.log(`Results count: ${resultData.data.results.length}`);
          if (resultData.data.results[0]) {
            console.log('\nFirst result:');
            console.log('  URL:', resultData.data.results[0].url || 'N/A');
            console.log('  Title:', resultData.data.results[0].title || 'N/A');
          }
        }
        if (resultData.data.records) {
          console.log(`Records count: ${resultData.data.records.length}`);
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

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════════════╗');
  console.log('║         Testing Previously Failing Tools with New API Keys       ║');
  console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🔑 New API Keys:');
  console.log('   Exa API Key: 1ef54dcc-0945-46af-9c84-c4e1834c0f05');
  console.log('   Exa Team ID: 3fbbdfbe-7fba-4e33-81e1-017781fe1d66');
  console.log('   Springer Key: e8001aa44f89572da32bb7ec8b7fafc3\n');

  try {
    // Initialize
    console.log('📡 Initializing MCP session...');
    await sendMCPRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'retest-client', version: '1.0.0' }
    });
    console.log('✅ Session initialized:', sessionId);

    // Test the two previously failing tools
    const testCases = [
      {
        name: 'research_health_exa',
        args: {
          query: 'latest cancer immunotherapy research papers',
          type: 'neural',
          num_results: 5
        }
      },
      {
        name: 'search_nature_springer',
        args: {
          query: 'Alzheimer disease treatment',
          open_access_only: false,
          rows: 5
        }
      }
    ];

    const results: any[] = [];
    
    for (const testCase of testCases) {
      const result = await testToolCall(testCase.name, testCase.args);
      results.push({ tool: testCase.name, ...result });
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Summary
    console.log('\n╔═══════════════════════════════════════════════════════════════════╗');
    console.log('║                         TEST SUMMARY                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════════╝\n');
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    console.log(`Total tests: ${results.length}`);
    console.log(`✅ Successful: ${successful.length}/${results.length}`);
    console.log(`❌ Failed: ${failed.length}/${results.length}`);
    
    if (successful.length > 0) {
      console.log('\n✅ Fixed Tools:');
      successful.forEach(r => {
        console.log(`   • ${r.tool}`);
      });
    }
    
    if (failed.length > 0) {
      console.log('\n❌ Still Failing:');
      failed.forEach(r => {
        console.log(`   • ${r.tool}: ${JSON.stringify(r.error)}`);
      });
    }

    console.log('\n' + '='.repeat(70));
    if (failed.length === 0) {
      console.log('🎉 ALL TOOLS NOW WORKING! Success rate: 100%');
      console.log('🚀 Combined with previous tests: 9/9 tools (100%) operational!');
    } else {
      console.log(`⚠️  ${failed.length} tool(s) still need attention`);
      console.log(`📊 Overall success rate: ${successful.length}/2 for retested tools`);
      console.log(`📊 Combined with previous tests: ${7 + successful.length}/9 tools working`);
    }
    console.log('='.repeat(70) + '\n');
    
    process.exit(failed.length === 0 ? 0 : 1);

  } catch (error: any) {
    console.error('\n❌ Fatal error:', error.message);
    if (error.response) {
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

