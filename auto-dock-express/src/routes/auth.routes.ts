import { Router, Request, Response } from 'express';
import { CredentialsRequest } from '../types/session';
import { ParsedMcpServer, McpConfiguration, parseAllMcpServers } from '../types/mcp-config.types';
import { logger } from '../utils/logger';

const router = Router();

/**
 * Store user credentials in session
 * POST /api/auth/credentials
 */
router.post('/credentials', (req: Request, res: Response): void => {
  try {
    const credentials: CredentialsRequest = req.body;

    // Validate required fields based on provider
    if (!credentials.provider) {
      res.status(400).json({ error: 'Provider is required' });
      return;
    }

    // Validate provider-specific requirements
    switch (credentials.provider) {
      case 'claude':
        if (!credentials.apiKey) {
          res.status(400).json({ error: 'API key is required for Claude' });
          return;
        }
        break;
      case 'openai':
        if (!credentials.apiKey) {
          res.status(400).json({ error: 'API key is required for OpenAI' });
          return;
        }
        break;
      case 'bedrock':
        if (!credentials.region || !credentials.accessKeyId || !credentials.secretAccessKey) {
          res.status(400).json({ error: 'AWS credentials are required for Bedrock' });
          return;
        }
        break;
      case 'custom':
        if (!credentials.baseURL) {
          res.status(400).json({ error: 'Base URL is required for custom provider' });
          return;
        }
        break;
    }

    // Store credentials in session
    req.session.credentials = credentials;

    logger.info(`Credentials stored in session for provider: ${credentials.provider}`);

    res.json({
      success: true,
      message: 'Credentials stored successfully',
      provider: credentials.provider
    });
  } catch (error) {
    logger.error('Error storing credentials:', error);
    res.status(500).json({ error: 'Failed to store credentials' });
  }
});

/**
 * Store MCP server configuration in session
 * POST /api/auth/mcp-config
 */
router.post('/mcp-config', (req: Request, res: Response): void => {
  try {
    const mcpConfig: McpConfiguration = req.body;

    // Validate configuration structure
    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
      res.status(400).json({ error: 'Invalid MCP configuration format' });
      return;
    }

    // Parse the configuration to extract URLs and headers
    const parsedServers = parseAllMcpServers(mcpConfig);
    
    // Store in session
    req.session.mcpServers = parsedServers;

    logger.info(`MCP configuration stored in session: ${parsedServers.length} servers`);
    parsedServers.forEach(server => {
      logger.info(`  - ${server.name}: ${server.url}, headers: ${server.headers ? Object.keys(server.headers).join(', ') : 'none'}`);
    });

    res.json({
      success: true,
      message: 'MCP configuration stored successfully',
      serverCount: parsedServers.length,
      servers: parsedServers.map(s => ({
        name: s.name,
        url: s.url,
        headerCount: s.headers ? Object.keys(s.headers).length : 0
      }))
    });
  } catch (error) {
    logger.error('Error storing MCP configuration:', error);
    res.status(500).json({ error: 'Failed to store MCP configuration' });
  }
});

/**
 * Get current session status
 * GET /api/auth/status
 */
router.get('/status', (req: Request, res: Response): void => {
  const hasCredentials = !!req.session.credentials;
  const provider = req.session.credentials?.provider;
  const mcpServerCount = req.session.mcpServers?.length || 0;

  res.json({
    authenticated: hasCredentials,
    provider: provider || null,
    sessionId: req.sessionID,
    mcpServers: mcpServerCount
  });
});

/**
 * Clear credentials from session
 * DELETE /api/auth/credentials
 */
router.delete('/credentials', (req: Request, res: Response): void => {
  try {
    const provider = req.session.credentials?.provider;
    
    req.session.credentials = undefined;
    
    logger.info(`Credentials cleared from session for provider: ${provider}`);

    res.json({
      success: true,
      message: 'Credentials cleared successfully'
    });
  } catch (error) {
    logger.error('Error clearing credentials:', error);
    res.status(500).json({ error: 'Failed to clear credentials' });
  }
});

/**
 * Destroy session completely
 * POST /api/auth/logout
 */
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }

    res.clearCookie('connect.sid');
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  });
});

export default router;

// Made with Bob