/**
 * Agent API Routes
 * Endpoints for interacting with the AI agent
 */

import { Router, Request, Response } from 'express';
import { AgentService } from '../services/agent.service';
import { QueryRequest, ErrorResponse, AIProviderConfig, MCPServerConfig } from '../types';
import { AIServiceFactory } from '../services/ai/ai-service.factory';
import { logger } from '../utils/logger';
import { ParsedMcpServer } from '../types/mcp-config.types';

export function createAgentRoutes(fallbackMcpServers: MCPServerConfig[]): Router {
  const router = Router();
  
  /**
   * Middleware to check session credentials
   */
  const requireCredentials = (req: Request, res: Response, next: Function) => {
    if (!req.session.credentials) {
      const error: ErrorResponse = {
        error: 'Unauthorized',
        message: 'No credentials found. Please configure your AI provider credentials first.',
        statusCode: 401,
        timestamp: new Date().toISOString()
      };
      res.status(401).json(error);
      return;
    }
    next();
  };
  
  /**
   * POST /api/agent/query
   * Process a user query
   */
  router.post('/query', requireCredentials, async (req: Request, res: Response): Promise<void> => {
    try {
      const queryRequest: QueryRequest = req.body;
      
      // Validate request
      if (!queryRequest.message) {
        const error: ErrorResponse = {
          error: 'Bad Request',
          message: 'Message is required',
          statusCode: 400,
          timestamp: new Date().toISOString()
        };
        res.status(400).json(error);
        return;
      }
      
      logger.info(`Received query request`);
      
      // Get credentials from session
      const credentials = req.session.credentials!;
      
      // Build AI provider config from session credentials
      const aiConfig: AIProviderConfig = {
        provider: credentials.provider,
        apiKey: credentials.apiKey || '',
        model: credentials.model || '',
        maxTokens: credentials.maxTokens,
        temperature: credentials.temperature,
        baseURL: credentials.baseURL,
        region: credentials.region,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      };
      
      // Create AI service with session credentials
      const aiService = AIServiceFactory.createService(aiConfig);
      
      // Get MCP servers from session or use fallback
      const sessionMcpServers = req.session.mcpServers;
      let mcpServers: MCPServerConfig[];
      
      if (sessionMcpServers && sessionMcpServers.length > 0) {
        // Convert ParsedMcpServer to MCPServerConfig format
        mcpServers = sessionMcpServers.map((server: ParsedMcpServer) => {
          logger.info(`Processing server ${server.name} (${server.transport})`);
          
          const config: MCPServerConfig = {
            name: server.name,
            transport: server.transport,
            description: server.transport === 'http'
              ? `MCP Server at ${server.url}`
              : `MCP Server: ${server.command}`
          };
          
          // Add transport-specific fields
          if (server.transport === 'http') {
            config.url = server.url;
            config.headers = server.headers;
          } else if (server.transport === 'stdio') {
            config.command = server.command;
            config.args = server.args;
            config.env = server.env;
          }
          
          return config;
        });
        logger.info(`Using ${mcpServers.length} MCP servers from session`);
        
        // Reinitialize MCP client manager with session configuration
        try {
          const { mcpClientManager } = await import('../services/mcp-client.service');
          logger.info('Reinitializing MCP client manager for query...');
          await mcpClientManager.initialize(mcpServers);
        } catch (error) {
          logger.warn('Could not reinitialize MCP clients:', error);
        }
      } else {
        // Use fallback servers from environment
        mcpServers = fallbackMcpServers;
        logger.info(`Using ${mcpServers.length} fallback MCP servers from environment`);
      }
      
      // Create agent service instance
      const agentService = new AgentService(aiService, mcpServers);
      
      // Process query
      const response = await agentService.processQuery(queryRequest);
      
      res.json(response);
    } catch (error) {
      logger.error('Error processing query:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * GET /api/agent/conversation/:id
   * Get conversation history
   */
  router.get('/conversation/:id', requireCredentials, (req: Request, res: Response): void => {
    try {
      // Note: Conversation history is currently stored per-request
      // For persistent history, we'd need to store it in session or database
      const error: ErrorResponse = {
        error: 'Not Implemented',
        message: 'Conversation history retrieval not yet implemented with session-based architecture',
        statusCode: 501,
        timestamp: new Date().toISOString()
      };
      res.status(501).json(error);
    } catch (error) {
      logger.error('Error getting conversation:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * DELETE /api/agent/conversation/:id
   * Clear conversation history
   */
  router.delete('/conversation/:id', requireCredentials, (req: Request, res: Response): void => {
    try {
      // Note: Conversation history is currently stored per-request
      res.json({
        message: 'Conversation history is managed per-request in session-based architecture',
        conversationId: req.params.id
      });
    } catch (error) {
      logger.error('Error clearing conversation:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * DELETE /api/agent/conversations
   * Clear all conversation histories
   */
  router.delete('/conversations', requireCredentials, (req: Request, res: Response): void => {
    try {
      res.json({ message: 'Conversation history is managed per-request in session-based architecture' });
    } catch (error) {
      logger.error('Error clearing conversations:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * GET /api/agent/mcp-status
   * Get MCP server status and available tools
   */
  router.get('/mcp-status', requireCredentials, async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Getting MCP server status');
      
      // Get credentials from session
      const credentials = req.session.credentials!;
      
      // Build AI provider config from session credentials
      const aiConfig: AIProviderConfig = {
        provider: credentials.provider,
        apiKey: credentials.apiKey || '',
        model: credentials.model || '',
        maxTokens: credentials.maxTokens,
        temperature: credentials.temperature,
        baseURL: credentials.baseURL,
        region: credentials.region,
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey
      };
      
      // Create AI service with session credentials
      const aiService = AIServiceFactory.createService(aiConfig);
      
      // Get MCP servers from session or use fallback
      const sessionMcpServers = req.session.mcpServers;
      let mcpServers: MCPServerConfig[];
      
      if (sessionMcpServers && sessionMcpServers.length > 0) {
        // Convert ParsedMcpServer to MCPServerConfig format
        mcpServers = sessionMcpServers.map((server: ParsedMcpServer) => {
          const config: MCPServerConfig = {
            name: server.name,
            transport: server.transport,
            description: server.transport === 'http'
              ? `MCP Server at ${server.url}`
              : `MCP Server: ${server.command}`
          };
          
          // Add transport-specific fields
          if (server.transport === 'http') {
            config.url = server.url;
            config.headers = server.headers;
          } else if (server.transport === 'stdio') {
            config.command = server.command;
            config.args = server.args;
            config.env = server.env;
          }
          
          return config;
        });
        logger.info(`Checking status of ${mcpServers.length} MCP servers from session`);
      } else {
        // Use fallback servers from environment
        mcpServers = fallbackMcpServers;
        logger.info(`Checking status of ${mcpServers.length} fallback MCP servers from environment`);
      }
      
      // Reinitialize MCP client manager with session configuration
      let allTools: any[] = [];
      let hasConnection = false;
      
      try {
        // Import mcpClientManager here to avoid circular dependencies
        const { mcpClientManager } = await import('../services/mcp-client.service');
        
        // Reinitialize with current session's MCP servers
        logger.info('Reinitializing MCP client manager with session configuration...');
        await mcpClientManager.initialize(mcpServers);
        
        // Get all tools after reinitialization
        allTools = mcpClientManager.getAllTools();
        hasConnection = allTools.length > 0;
        logger.info(`Retrieved ${allTools.length} total tools from MCP servers`);
        
        // Log tool server names for debugging
        const serverNames = new Set(allTools.map((tool: any) => tool.server).filter(Boolean));
        logger.info(`Tool server names found: ${Array.from(serverNames).join(', ')}`);
      } catch (error) {
        logger.warn('Could not retrieve tools from MCP servers:', error);
      }
      
      // Map server status based on available tools
      const serverStatuses = mcpServers.map((server) => {
        // Filter tools for this server - use exact match only
        // The MCP client manager should set tool.server to match the config server name
        const serverTools = allTools.filter((tool: any) => {
          if (!tool.server) return false;
          
          const toolServer = tool.server.toLowerCase();
          const configServer = server.name.toLowerCase();
          
          // Exact match only - no fuzzy matching
          return toolServer === configServer;
        });
        
        const status = {
          name: server.name,
          connected: hasConnection && serverTools.length > 0,
          toolCount: serverTools.length,
          tools: serverTools.map((tool: any) => ({
            name: tool.name,
            description: tool.description || 'No description available'
          }))
        };
        
        logger.info(`Server "${server.name}": ${status.connected ? 'Connected' : 'Disconnected'}, ${status.toolCount} tools, tool.server names: ${serverTools.map((t: any) => t.server).join(', ')}`);
        
        return status;
      });
      
      res.json({ servers: serverStatuses });
    } catch (error) {
      logger.error('Error getting MCP server status:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * GET /api/agent/prompts
   * Get all available prompts from MCP servers
   */
  router.get('/prompts', requireCredentials, async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('Getting available prompts');
      
      // Get MCP servers from session or use fallback
      const sessionMcpServers = req.session.mcpServers;
      let mcpServers: MCPServerConfig[];
      
      if (sessionMcpServers && sessionMcpServers.length > 0) {
        mcpServers = sessionMcpServers.map((server: ParsedMcpServer) => {
          const config: MCPServerConfig = {
            name: server.name,
            transport: server.transport,
            description: server.transport === 'http'
              ? `MCP Server at ${server.url}`
              : `MCP Server: ${server.command}`
          };
          
          if (server.transport === 'http') {
            config.url = server.url;
            config.headers = server.headers;
          } else if (server.transport === 'stdio') {
            config.command = server.command;
            config.args = server.args;
            config.env = server.env;
          }
          
          return config;
        });
      } else {
        mcpServers = fallbackMcpServers;
      }
      
      // Reinitialize MCP client manager
      try {
        const { mcpClientManager } = await import('../services/mcp-client.service');
        await mcpClientManager.initialize(mcpServers);
        
        const allPrompts = mcpClientManager.getAllPrompts();
        logger.info(`Retrieved ${allPrompts.length} total prompts from MCP servers`);
        
        res.json({ prompts: allPrompts });
      } catch (error) {
        logger.warn('Could not retrieve prompts from MCP servers:', error);
        res.json({ prompts: [] });
      }
    } catch (error) {
      logger.error('Error getting prompts:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  /**
   * POST /api/agent/prompts/:server/:name
   * Get a filled prompt template
   */
  router.post('/prompts/:server/:name', requireCredentials, async (req: Request, res: Response): Promise<void> => {
    try {
      const { server, name } = req.params;
      const args = req.body.arguments || {};
      
      logger.info(`Getting prompt ${name} from server ${server}`);
      
      // Get MCP servers from session or use fallback
      const sessionMcpServers = req.session.mcpServers;
      let mcpServers: MCPServerConfig[];
      
      if (sessionMcpServers && sessionMcpServers.length > 0) {
        mcpServers = sessionMcpServers.map((server: ParsedMcpServer) => {
          const config: MCPServerConfig = {
            name: server.name,
            transport: server.transport,
            description: server.transport === 'http'
              ? `MCP Server at ${server.url}`
              : `MCP Server: ${server.command}`
          };
          
          if (server.transport === 'http') {
            config.url = server.url;
            config.headers = server.headers;
          } else if (server.transport === 'stdio') {
            config.command = server.command;
            config.args = server.args;
            config.env = server.env;
          }
          
          return config;
        });
      } else {
        mcpServers = fallbackMcpServers;
      }
      
      // Reinitialize MCP client manager
      const { mcpClientManager } = await import('../services/mcp-client.service');
      await mcpClientManager.initialize(mcpServers);
      
      const promptResult = await mcpClientManager.getPrompt(server, name, args);
      
      if (!promptResult) {
        res.status(404).json({
          error: 'Not Found',
          message: `Prompt ${name} not found on server ${server}`,
          statusCode: 404,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      res.json(promptResult);
    } catch (error) {
      logger.error('Error getting prompt:', error);
      
      const errorResponse: ErrorResponse = {
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error',
        statusCode: 500,
        timestamp: new Date().toISOString()
      };
      
      res.status(500).json(errorResponse);
    }
  });
  
  return router;
}

// Made with Bob
