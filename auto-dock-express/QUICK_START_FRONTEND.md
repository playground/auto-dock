# Quick Start - Auto-Dock Express with Frontend

Get the Auto-Dock Express application with Angular frontend up and running in minutes.

## Prerequisites

- Node.js 18+ and npm
- Open Horizon CLI (`hzn`) installed
- Git

## Quick Setup

### 1. Install Dependencies

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
npm run frontend:install
```

### 2. Configure Environment

Create or update `.env` file in the root directory:

```env
PORT=8888
CORS_ORIGIN=http://localhost:8888
SESSION_SECRET=your-secret-key-change-in-production
COOKIE_SECURE=false
COOKIE_SAMESITE=lax

# Optional: Configure MCP servers
MCP_SERVERS=http://localhost:3000/mcp
MCP_SERVER_NAMES=open-horizon-mcp
```

### 3. Start the Application

**Option A: Use pre-built frontend (fastest)**
```bash
npm run dev
```

The application will be available at `http://localhost:8888`

**Option B: Build frontend first (if you made changes)**
```bash
npm run frontend:build
npm run dev
```

**Option C: Development mode with Angular dev server**
```bash
# Terminal 1: Start Angular dev server
npm run frontend:start

# Terminal 2: Start backend
npm run dev
```
- Frontend: `http://localhost:4200`
- Backend API: `http://localhost:8888`

## What You Get

### Features

✅ **Web UI** - Modern Angular interface  
✅ **Chat Interface** - Interactive AI agent chat  
✅ **MCP Integration** - Full Model Context Protocol support  
✅ **Open Horizon Tools** - 20+ CLI tools via MCP  
✅ **PWA Support** - Install as desktop/mobile app  
✅ **Session Management** - Secure credential handling  
✅ **Real-time Updates** - Live tool execution feedback  

### Available Tools

The MCP server provides 20 Open Horizon management tools:

**Node Management:**
- list-nodes
- get-node-status
- register-node
- unregister-node
- admin-status

**Service Management:**
- list-services
- get-service-details
- generate-service-definition
- publish-service
- remove-service

**Agreement Management:**
- list-agreements
- get-agreement-details
- cancel-agreement

**Policy Management:**
- list-deployment-policies
- add-deployment-policy
- update-deployment-policy
- remove-deployment-policy
- check-policy-deployments
- check-policy-compatibility

## Using the Application

### 1. Set Up Credentials

On first launch, you'll be prompted to enter your AI provider credentials:

- **OpenAI**: API Key
- **Anthropic Claude**: API Key
- **AWS Bedrock**: Access Key ID, Secret Access Key, Region

These are stored securely in your session.

### 2. Chat with the Agent

Type natural language commands:

```
"List all my edge nodes"
"Show me the status of node xyz"
"Generate a service definition for my-service version 1.0.0"
"What deployment policies do I have?"
```

### 3. View Tool Execution

The UI shows:
- Tool being called
- Parameters used
- Execution results
- Any errors

### 4. Configure MCP Servers

Go to Settings to:
- Add/remove MCP servers
- View available tools
- Test connections
- Update credentials

## API Endpoints

The backend provides these endpoints:

### Authentication
- `POST /api/auth/credentials` - Set AI credentials

### Agent
- `POST /api/agent/query` - Send chat message
- `GET /api/agent/conversation/:id` - Get conversation

### Health
- `GET /api/health` - Backend health check
- `GET /mcp/health` - MCP server health

### MCP Protocol
- `POST /mcp` - MCP protocol endpoint

## Development

### Frontend Development

```bash
# Watch mode - auto-rebuild on changes
npm run frontend:watch

# Start dev server with hot reload
npm run frontend:start

# Build for production
npm run frontend:build

# Run tests
cd frontend && npm test

# Lint code
cd frontend && npm run lint
```

### Backend Development

```bash
# Development mode with auto-restart
npm run dev

# Build TypeScript
npm run build

# Run tests
npm test
```

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 8888
npm run kill-port
```

### Frontend Not Loading

1. Check web directory exists: `ls -la web/`
2. Rebuild frontend: `npm run frontend:build`
3. Check server logs for errors

### API Connection Failed

1. Verify backend is running: `curl http://localhost:8888/api/health`
2. Check `.env` file configuration
3. Verify CORS settings

### MCP Tools Not Working

1. Verify `hzn` CLI is installed: `hzn version`
2. Check MCP server health: `curl http://localhost:8888/mcp/health`
3. Ensure you're registered with Open Horizon

## Production Deployment

### Build for Production

```bash
# Build frontend
npm run frontend:build

# Build backend
npm run build

# Start production server
npm start
```

### Docker Deployment

```bash
# Build Docker image
npm run build:amd64-image
# or
npm run build:arm64-image

# Run container
docker run -p 8888:8888 \
  -e PORT=8888 \
  -e SESSION_SECRET=your-secret \
  playbox21/auto-dock-express_amd64:1.0.8
```

## Next Steps

- Read [FRONTEND_README.md](./FRONTEND_README.md) for detailed frontend documentation
- Check [MCP_SERVER_INTEGRATION.md](./MCP_SERVER_INTEGRATION.md) for MCP details
- Explore the Angular source in `frontend/src/`
- Customize the UI to your needs

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the detailed documentation
3. Check server logs in `logs/`

---

Made with Bob 🤖