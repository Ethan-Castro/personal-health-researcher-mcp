#!/bin/bash

# Export the Dedalus API key and other environment variables
export DEDALUS_API_KEY="dsk_live_de8a5ff4a153_1dd8ff0c5ef1126841188d123f8fb310"
export PORT=3000

# Note: Add your other API keys here if you have them
# export EXA_API_KEY="your_key"
# export PARALLEL_API_KEY="your_key"
# export FIRECRAWL_API_KEY="your_key"
# export SPRINGER_API_KEY="your_key"

echo "🚀 Starting Health Research MCP Server..."
echo "📍 Server will run on http://localhost:3000/mcp"
echo "🔑 Dedalus API Key: $DEDALUS_API_KEY"
echo ""

# Start the server in development mode
npm run dev

