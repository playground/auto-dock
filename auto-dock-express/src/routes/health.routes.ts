/**
 * Health Check Routes
 * Endpoints for monitoring server health and status
 */

import { Router, Request, Response } from 'express';
import { mcpClientManager } from '../services/mcp-client.service';
import { ServerHealth } from '../types';
import { logger } from '../utils/logger';

const startTime = Date.now();

export function createHealthRoutes(): Router {
  const router = Router();
  
  /**
   * GET /api/health
   * Get server health status
   */
  router.get('/', (req: Request, res: Response) => {
    try {
      const mcpServers = mcpClientManager.getServerStatus();
      const allConnected = mcpServers.every(server => server.connected);
      
      const health: ServerHealth = {
        status: allConnected ? 'healthy' : 'degraded',
        aiProvider: {
          provider: (process.env.AI_PROVIDER || 'claude') as any,
          model: process.env.AI_PROVIDER === 'claude'
            ? process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
            : process.env.OPENAI_MODEL || 'gpt-4-turbo-preview',
          available: true
        },
        mcpServers,
        uptime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
      
      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    } catch (error) {
      logger.error('Error getting health status:', error);
      
      res.status(500).json({
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  /**
   * GET /api/health/mcp
   * Get MCP servers status
   */
  router.get('/mcp', (req: Request, res: Response) => {
    try {
      const mcpServers = mcpClientManager.getServerStatus();
      const allTools = mcpClientManager.getAllTools();
      
      res.json({
        servers: mcpServers,
        totalTools: allTools.length,
        tools: allTools.map(tool => ({
          name: tool.name,
          server: tool.server,
          description: tool.description
        }))
      });
    } catch (error) {
      logger.error('Error getting MCP status:', error);
      
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
    }
  });
  
  return router;
}

// Made with Bob
