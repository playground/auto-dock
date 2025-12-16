/**
 * MCP Orchestrator Backend Server
 * Express server with AI agent and MCP integration
 */

import log4js from 'log4js';
import express, { Express, Request, Response, NextFunction } from 'express';
import session from 'express-session';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import { randomUUID } from 'crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { MCPServerConfig } from './types';
import { mcpClientManager } from './services/mcp-client.service';
import { AIServiceFactory } from './services/ai/ai-service.factory';
import { AgentService } from './services/agent.service';
import { createAgentRoutes } from './routes/agent.routes';
import { createHealthRoutes } from './routes/health.routes';
import authRoutes from './routes/auth.routes';
import { logger } from './utils/logger';
import './types/session'; // Import session type extensions
import { SessionEntry } from './models/model';
import { createMcpServer } from './mcp-server';

// Load environment variables
dotenv.config();

/**
 * In-memory session store for MCP connections:
 *   sessions[sessionId] = {
 *     server:   McpServer instance for this session,
 *     transport: StreamableHTTPServerTransport bound to this session
 *   }
 */
const sessions: Record<string, SessionEntry> = {};

// Define a simple object to hold the request context
const requestContext = {
  headers: {} as Record<string, string | string[] | undefined>
};

const l = log4js.getLogger();

const MCP_PATH = '/mcp';

const app: Express = express();
app.use(express.json());

const PORT = process.env.PORT || 8888;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for Angular app
  crossOriginEmbedderPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || `http://localhost:${PORT}`,
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'mcp-orchestrator-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.COOKIE_SECURE === 'true', // Set via env var for Docker compatibility
    httpOnly: true, // Prevent XSS attacks
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: (process.env.COOKIE_SAMESITE as 'strict' | 'lax' | 'none') || 'lax',
    path: '/', // Explicitly set cookie path
    domain: process.env.COOKIE_DOMAIN || undefined // Allow domain override for Docker
  }
}));

app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim())
  }
}));

// Debug logging middleware for MCP requests
app.use((req, res, next) => {
  if (req.path.startsWith('/mcp')) {
    console.log(`> ${req.method} ${req.originalUrl}`);
    if (req.body && Object.keys(req.body).length > 0) {
      console.log(JSON.stringify(req.body, null, 2));
    }
  }
  return next();
});

// Parse MCP server configuration from environment
function parseMCPServers(): MCPServerConfig[] {
  const serversEnv = process.env.MCP_SERVERS || '';
  const namesEnv = process.env.MCP_SERVER_NAMES || '';
  
  if (!serversEnv) {
    logger.warn('No MCP servers configured');
    return [];
  }
  
  const urls = serversEnv.split(',').map(s => s.trim()).filter(Boolean);
  const names = namesEnv.split(',').map(s => s.trim()).filter(Boolean);
  
  return urls.map((url, index) => ({
    name: names[index] || `mcp-server-${index + 1}`,
    transport: 'http' as const,
    url,
    description: `MCP Server at ${url}`
  }));
}

/**
 * Handler for POST /mcp:
 *   1. If "mcp-session-id" header exists and matches a stored session, reuse that session.
 *   2. If no "mcp-session-id" and request is initialize, create new session.
 *   3. Otherwise, return a 400 error.
 */
app.post(MCP_PATH, async (req, res) => {
  const sessionIdHeader = req.headers['mcp-session-id'];
  let sessionEntry: SessionEntry | null = null;

  // Case 1: Existing session found
  const sessionId =
    typeof sessionIdHeader === 'string'
      ? sessionIdHeader
      : Array.isArray(sessionIdHeader)
      ? sessionIdHeader[0]
      : undefined;

  if (sessionId && sessions[sessionId]) {
    sessionEntry = sessions[sessionId];
    
    // Update the shared context with the current request headers
    requestContext.headers = req.headers;

  // Case 2: Initialization request → create new transport + server
  } else if (!sessionIdHeader && isInitializeRequest(req.body)) {
    const newSessionId = randomUUID();
    
    console.log('✓ Creating new MCP session:', newSessionId);
    
    // Update the shared context with the request headers
    requestContext.headers = req.headers;
    
    // Create and configure the new McpServer
    const server = createMcpServer(req.headers);

    // Create a new transport for this session
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => newSessionId,
      onsessioninitialized: (sid: string) => {
        // Store the Transport and Server instance once session is initialized
        sessions[sid] = {
          server,
          transport,
          latestHeaders: req.headers
        };
        console.log(`✓ MCP session initialized: ${sid}`);
      }
    });

    // When this transport closes, clean up the session entry
    transport.onclose = () => {
      if (transport.sessionId && sessions[transport.sessionId]) {
        delete sessions[transport.sessionId];
        console.log(`MCP session closed: ${transport.sessionId}`);
      }
    };

    await server.connect(transport);

    // Assign session entry for immediate access
    sessions[newSessionId] = {
      server,
      transport,
      latestHeaders: req.headers
    };
    sessionEntry = sessions[newSessionId];

  } else {
    // Neither a valid session nor an initialize request → return error
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
      id: null
    });
    return;
  }

  // Forward the request to the transport of the retrieved/created session
  console.log(`Forwarding request to MCP transport for session`);
  try {
    await sessionEntry.transport.handleRequest(req, res, req.body);
    console.log(`MCP request handled successfully`);
  } catch (error: any) {
    console.error(`Error handling MCP request:`, error);
    res.status(500).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: `Internal server error: ${error.message || 'Unknown error'}` },
      id: req.body.id || null
    });
  }
});

/**
 * Handler for GET/DELETE /mcp:
 *   Used for server-to-client notifications (SSE) and session termination.
 */
async function handleSessionRequest(req: Request, res: Response) {
  const sessionIdHeader = req.headers['mcp-session-id'];
  const sessionId =
    typeof sessionIdHeader === 'string'
      ? sessionIdHeader
      : Array.isArray(sessionIdHeader)
      ? sessionIdHeader[0]
      : undefined;
  
  if (!sessionId || !sessions[sessionId]) {
    res.statusCode = 400;
    res.send('Invalid or missing session ID');
    return;
  }
  
  const sessionEntry = sessions[sessionId];
  const { transport } = sessionEntry;
  await transport.handleRequest(req, res);
}

app.get(MCP_PATH, handleSessionRequest);
app.delete(MCP_PATH, handleSessionRequest);

// MCP Health check endpoint
app.get('/mcp/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    activeSessions: Object.keys(sessions).length,
    mcpEndpoint: `http://localhost:${PORT}/mcp`
  });
});

// Initialize services
async function initializeServices() {
  try {
    logger.info('Initializing services...');
    
    // Parse MCP server configuration
    const mcpServers = parseMCPServers();
    logger.info(`Found ${mcpServers.length} MCP servers in configuration`);
    
    // Initialize MCP clients
    await mcpClientManager.initialize(mcpServers);
    
    // Note: AI service is now created per-request using session credentials
    logger.info('Session-based authentication enabled');
    
    // Register API routes
    app.use('/api/auth', authRoutes);
    app.use('/api/agent', createAgentRoutes(mcpServers));
    app.use('/api/health', createHealthRoutes());
    
    // Serve static files from the Angular app
    const webPath = path.join(__dirname, '..', 'web');
    app.use(express.static(webPath));
    
    // API info endpoint
    app.get('/api', (req: Request, res: Response) => {
      res.json({
        name: 'MCP Orchestrator Backend Agent',
        version: '1.0.0',
        status: 'running',
        authMode: 'session-based',
        mcpServers: mcpServers.length,
        endpoints: {
          health: '/api/health',
          auth: '/api/auth/credentials',
          query: '/api/agent/query',
          conversation: '/api/agent/conversation/:id'
        }
      });
    });
    
    // Serve Angular app for all non-API and non-MCP routes (SPA fallback)
    app.use((req: Request, res: Response, next: NextFunction) => {
      // Skip if it's an API or MCP route
      if (req.path.startsWith('/api/') || req.path.startsWith('/mcp')) {
        return next();
      }
      // Serve index.html for all other routes
      res.sendFile(path.join(webPath, 'index.html'));
    });
    
    // Error handler
    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error:', err);
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: err.message,
        statusCode: 500,
        timestamp: new Date().toISOString()
      });
    });
    
    logger.info('Services initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize services:', error);
    throw error;
  }
}

// Start server
async function startServer() {
  try {
    await initializeServices();
    
    app.listen(PORT, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 Auto-Dock Express Server with MCP Integration');
      console.log('='.repeat(60));
      logger.info(`📍 Port: ${PORT}`);
      logger.info(`🔐 Auth Mode: Session-based (users provide their own API keys)`);
      logger.info(`🔌 MCP Client Servers: ${process.env.MCP_SERVERS || 'none'}`);
      logger.info(`🌐 CORS Origin: ${process.env.CORS_ORIGIN || `http://localhost:${PORT}`}`);
      logger.info(`🍪 Cookie Secure: ${process.env.COOKIE_SECURE === 'true'}`);
      logger.info(`🍪 Cookie SameSite: ${process.env.COOKIE_SAMESITE || 'lax'}`);
      console.log('='.repeat(60));
      console.log('\n📡 MCP Server Endpoints:');
      console.log(`  🔧 MCP Protocol: http://localhost:${PORT}/mcp`);
      console.log(`  💚 MCP Health: http://localhost:${PORT}/mcp/health`);
      console.log('\n📊 API Endpoints:');
      console.log(`  💚 API Health: http://localhost:${PORT}/api/health`);
      console.log(`  🔐 Auth: http://localhost:${PORT}/api/auth/credentials`);
      console.log(`  🤖 Agent Query: http://localhost:${PORT}/api/agent/query`);
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  await mcpClientManager.disconnectAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully...');
  await mcpClientManager.disconnectAll();
  process.exit(0);
});

// Start the server
startServer();
