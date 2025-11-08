#!/bin/bash

# Quick manual test script for Health Research MCP Server
# Usage: ./quick-test.sh

set -e

BASE_URL="http://localhost:3000/mcp"
DEDALUS_KEY="dsk_live_de8a5ff4a153_1dd8ff0c5ef1126841188d123f8fb310"

echo "╔════════════════════════════════════════════════════════╗"
echo "║   Health Research MCP - Quick Manual Test Script      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "🔑 Dedalus API Key: $DEDALUS_KEY"
echo "🌐 Server: $BASE_URL"
echo ""

# Check if server is running
echo "📡 Checking if server is running..."
if ! curl -s "$BASE_URL" > /dev/null 2>&1; then
    echo "❌ Server is not responding at $BASE_URL"
    echo "💡 Start the server with: npm run dev"
    exit 1
fi
echo "✅ Server is responding"
echo ""

# Initialize session
echo "🔧 Initializing MCP session..."
INIT_RESPONSE=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {"name": "quick-test", "version": "1.0.0"}
    },
    "id": 1
  }')

SESSION_ID=$(echo "$INIT_RESPONSE" | grep -o '"mcp-session-id":"[^"]*"' | cut -d'"' -f4)
if [ -z "$SESSION_ID" ]; then
    SESSION_ID=$(echo "$INIT_RESPONSE" | jq -r '.result.sessionId // empty')
fi

echo "✅ Session initialized"
echo ""

# List tools
echo "📋 Listing available tools..."
curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/list",
    "params": {},
    "id": 2
  }' | jq -r '.result.tools[] | "  \(.name): \(.description)"'
echo ""

# Test 1: PubMed
echo "🧪 Test 1: Searching PubMed..."
PUBMED_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_pubmed",
      "arguments": {
        "query": "COVID-19 treatment",
        "max_results": 3
      }
    },
    "id": 3
  }')

if echo "$PUBMED_RESULT" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    echo "✅ PubMed search successful"
    echo "$PUBMED_RESULT" | jq '.result.content[0].text | fromjson | .data.count' | xargs echo "   Found articles:"
else
    echo "❌ PubMed search failed"
fi
echo ""

# Test 2: Europe PMC
echo "🧪 Test 2: Searching Europe PMC..."
EUROPEPMC_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_europepmc",
      "arguments": {
        "query": "machine learning healthcare",
        "limit": 3,
        "open_access_only": true
      }
    },
    "id": 4
  }')

if echo "$EUROPEPMC_RESULT" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    echo "✅ Europe PMC search successful"
    echo "$EUROPEPMC_RESULT" | jq '.result.content[0].text | fromjson | .data.hitCount' | xargs echo "   Total hits:"
else
    echo "❌ Europe PMC search failed"
fi
echo ""

# Test 3: PLOS
echo "🧪 Test 3: Searching PLOS journals..."
PLOS_RESULT=$(curl -s -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -H "mcp-session-id: $SESSION_ID" \
  -d '{
    "jsonrpc": "2.0",
    "method": "tools/call",
    "params": {
      "name": "search_plos",
      "arguments": {
        "query": "diabetes",
        "journal": "PLOS Medicine",
        "rows": 3
      }
    },
    "id": 5
  }')

if echo "$PLOS_RESULT" | jq -e '.result.content[0].text' > /dev/null 2>&1; then
    echo "✅ PLOS search successful"
    echo "$PLOS_RESULT" | jq '.result.content[0].text | fromjson | .data.response.numFound' | xargs echo "   Total found:"
else
    echo "❌ PLOS search failed"
fi
echo ""

echo "╔════════════════════════════════════════════════════════╗"
echo "║                    Test Complete!                      ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "💡 For comprehensive tests, run: npx tsx test-all-tools.ts"
echo ""

