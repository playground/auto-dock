# MCP Server Integration Documentation

## Overview

The auto-dock-express server now includes a fully integrated MCP (Model Context Protocol) server that runs alongside the existing Express API on port 3300. This allows the server to act as both:
1. **MCP Server** - Providing tools and resources via the MCP protocol
2. **API Server** - Serving REST API endpoints for agent operations

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│         Auto-Dock Express Server (Port 3300)                │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────┐         ┌──────────────────┐          │
│  │   API Routes     │         │   MCP Endpoints  │          │
│  │                  │         │                  │          │
│  │ /api/health      │         │ POST /mcp        │          │
│  │ /api/auth        │         │ GET /mcp         │          │
│  │ /api/agent       │         │ DELETE /mcp      │          │
│  │                  │         │ GET /mcp/health  │          │
│  └──────────────────┘         └──────────────────┘          │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         Session Management                          │    │
│  │  - StreamableHTTPServerTransport                    │    │
│  │  - In-memory session store                          │    │
│  │  - Automatic cleanup on disconnect                  │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │         MCP Server Instance (per session)           │    │
│  │  - Tools registration (future)                      │    │
│  │  - Resources (future)                               │    │
│  │  - Prompts (future)                                 │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### ✅ Implemented
- **Dual Protocol Support**: Serves both HTTP REST API and MCP protocol on the same port
- **Session Management**: Stateful MCP sessions with automatic cleanup
- **StreamableHTTP Transport**: Uses MCP SDK's StreamableHTTPServerTransport
- **Health Monitoring**: Dedicated health check endpoints for both API and MCP
- **No Self-Connection**: Server provides MCP endpoint but doesn't connect to itself
- **Error-Free Startup**: Resolved "Missing parameter name" error by removing self-reference

### 🔜 Future Enhancements
- Tool registration for Open Horizon operations
- Resource providers for documentation
- Prompt templates for common tasks

## Endpoints

### MCP Protocol Endpoints

#### POST /mcp
Main MCP protocol endpoint for client-server communication.

**Headers Required:**
- `Content-Type: application/json`
- `Accept: application/json, text/event-stream`
- `mcp-session-id: <session-id>` (for existing sessions)

**Example Initialize Request:**
```bash
curl -X POST http://localhost:3300/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

#### GET /mcp
Server-to-client notifications via Server-Sent Events (SSE).

**Headers Required:**
- `mcp-session-id: <session-id>`

#### DELETE /mcp
Terminate an MCP session.

**Headers Required:**
- `mcp-session-id: <session-id>`

#### GET /mcp/health
Health check for MCP server.

**Response:**
```json
{
  "status": "healthy",
  "activeSessions": 2,
  "mcpEndpoint": "http://localhost:3300/mcp"
}
```

### API Endpoints

#### GET /api/health
Health check for the API server.

**Response:**
```json
{
  "status": "healthy",
  "aiProvider": {
    "provider": "bedrock",
    "model": "gpt-4-turbo-preview",
    "available": true
  },
  "mcpServers": [],
  "uptime": 43931,
  "timestamp": "2025-12-16T22:38:56.532Z"
}
```

## Configuration

### Environment Variables (.env)

```bash
# Server Configuration
PORT=3300
NODE_ENV=development

# MCP Server Configuration
# NOTE: Leave empty - this server PROVIDES an MCP endpoint
# Do not configure it to connect to itself
MCP_SERVERS=
MCP_SERVER_NAMES=

# AI Provider Configuration
AI_PROVIDER=bedrock
AWS_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-3-haiku-20240307-v1:0

# Session Configuration
SESSION_SECRET=your-secret-here
CORS_ORIGIN=http://localhost:4200
```

### Important Configuration Notes

1. **MCP_SERVERS**: Must be empty or not include `http://localhost:3300/mcp`
   - The server PROVIDES the MCP endpoint
   - It should NOT connect to itself as a client
   - This prevents the "chicken-and-egg" initialization problem

2. **Port 3300**: Both API and MCP endpoints share the same port
   - API routes: `/api/*`
   - MCP routes: `/mcp*`

## Client Configuration

### Claude Desktop Configuration

To connect Claude Desktop to this MCP server:

```json
{
  "mcpServers": {
    "auto-dock": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3300/mcp"
      ]
    }
  }
}
```

### Custom MCP Client

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const transport = new StreamableHTTPClientTransport({
  url: 'http://localhost:3300/mcp'
});

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, {
  capabilities: {}
});

await client.connect(transport);
```

## Session Management

### Session Lifecycle

1. **Initialization**: Client sends `initialize` request without `mcp-session-id` header
2. **Session Creation**: Server creates new session with UUID
3. **Session Storage**: Session stored in-memory with server instance and transport
4. **Subsequent Requests**: Client includes `mcp-session-id` header
5. **Cleanup**: Session automatically removed when connection closes

### Session Store Structure

```typescript
interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  latestHeaders?: IncomingHttpHeaders;
}

const sessions: Record<string, SessionEntry> = {};
```

## Development

### Running the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm run build
npm start
```

### Testing MCP Endpoints

```bash
# Test health endpoint
curl http://localhost:3300/mcp/health

# Test initialize (creates new session)
curl -X POST http://localhost:3300/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    }
  }'
```

## Troubleshooting

### Common Issues

#### 1. "Missing parameter name at index 1: *"
**Cause**: Express 5.x doesn't support wildcard `*` route pattern
**Solution**: Use middleware instead of `app.get('*', ...)` for SPA fallback

#### 2. "ECONNREFUSED" during startup
**Cause**: Server trying to connect to itself as MCP client
**Solution**: Ensure `MCP_SERVERS` in `.env` is empty or doesn't include self-reference

#### 3. "Not Acceptable: Client must accept both application/json and text/event-stream"
**Cause**: Missing required Accept headers
**Solution**: Include both content types in Accept header

### Debug Logging

The server includes debug logging for MCP requests:
```
> POST /mcp
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  ...
}
✓ Creating new MCP session: <session-id>
Creating new MCP server instance...
MCP server instance created successfully
✓ MCP session initialized: <session-id>
```

## Files Modified

### Core Files
- `src/server.ts` - Main server with MCP endpoint handlers
- `src/mcp-server.ts` - MCP server factory function
- `src/models/model.ts` - Session entry type definitions
- `.env` - Configuration (removed self-reference)

### Key Changes
1. Added MCP endpoint handlers (POST/GET/DELETE `/mcp`)
2. Implemented session management with StreamableHTTPServerTransport
3. Added MCP health check endpoint
4. Fixed Express 5.x wildcard route issue
5. Removed self-connection from MCP_SERVERS configuration

## Next Steps

### Tool Registration
When ready to add tools, update `src/mcp-server.ts`:

```typescript
import { registerDeviceTools } from './tools/device-tools';
import { registerPolicyTools } from './tools/policy-tools';

export function createMcpServer(initialHeaders: IncomingHttpHeaders): McpServer {
  const server = new McpServer(/* ... */);
  
  // Register tools
  registerDeviceTools(server);
  registerPolicyTools(server);
  
  return server;
}
```

### Resource Providers
Add documentation and data resources:

```typescript
server.setRequestHandler(ListResourcesRequestSchema, async () => ({
  resources: [
    {
      uri: 'docs://open-horizon/getting-started',
      name: 'Getting Started Guide',
      mimeType: 'text/markdown'
    }
  ]
}));
```

## References

- [MCP Specification](https://spec.modelcontextprotocol.io/)
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [StreamableHTTP Transport](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/server/streamableHttp.ts)

---

**Status**: ✅ MCP Server Integration Complete
**Version**: 1.0.0
**Last Updated**: 2025-12-16
**Author**: Bob (AI Assistant)