/**
 * MCP Client Service
 * Handles communication with MCP servers (both HTTP/SSE and stdio)
 */

import { MCPServerConfig, MCPTool, MCPClientResponse, MCPPrompt, MCPPromptResult } from '../types';
import { logger } from '../utils/logger';

// Import MCP SDK
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');

/**
 * MCP Client for a single server
 */
class MCPClient {
  private client: any;
  private transport: any;
  private connected: boolean = false;
  private tools: MCPTool[] = [];
  private prompts: MCPPrompt[] = [];
  
  constructor(
    private config: MCPServerConfig
  ) {}
  
  /**
   * Connect to the MCP server (supports both HTTP/SSE and stdio transports)
   */
  async connect(): Promise<void> {
    try {
      logger.info(`Connecting to MCP server: ${this.config.name} (transport: ${this.config.transport})`);
      
      // Create transport based on type
      if (this.config.transport === 'http') {
        // HTTP/SSE transport
        if (!this.config.url) {
          throw new Error(`HTTP transport requires a URL for server ${this.config.name}`);
        }
        
        logger.info(`Creating HTTP transport for ${this.config.name} at ${this.config.url}`);
        const url = new URL(this.config.url);
        
        // Create transport options with headers in requestInit
        const transportOptions: any = {};
        
        // Add headers if provided in config
        if (this.config.headers && Object.keys(this.config.headers).length > 0) {
          transportOptions.requestInit = {
            headers: this.config.headers
          };
          logger.info(`✅ Using custom headers for ${this.config.name}`);
        }
        
        this.transport = new StreamableHTTPClientTransport(url, transportOptions);
      } else if (this.config.transport === 'stdio') {
        // Stdio transport
        if (!this.config.command) {
          throw new Error(`Stdio transport requires a command for server ${this.config.name}`);
        }
        
        logger.info(`Creating stdio transport for ${this.config.name}: ${this.config.command} ${this.config.args?.join(' ') || ''}`);
        
        this.transport = new StdioClientTransport({
          command: this.config.command,
          args: this.config.args || [],
          env: this.config.env
        });
      } else {
        throw new Error(`Unknown transport type: ${this.config.transport}`);
      }
      
      // Create client
      this.client = new Client(
        {
          name: 'mcp-orchestrator-agent',
          version: '1.0.0'
        },
        {
          capabilities: {
            roots: { listChanged: true },
            sampling: {}
          }
        }
      );
      
      // Connect
      await this.client.connect(this.transport);
      this.connected = true;
      
      // Discover tools and prompts
      await this.discoverTools();
      await this.discoverPrompts();
      
      logger.info(`✅ Connected to ${this.config.name}, discovered ${this.tools.length} tools and ${this.prompts.length} prompts`);
    } catch (error) {
      logger.error(`❌ Failed to connect to ${this.config.name}:`, error);
      this.connected = false;
      throw error;
    }
  }
  
  /**
   * Discover available tools from the MCP server
   */
  private async discoverTools(): Promise<void> {
    try {
      const result = await this.client.listTools();
      this.tools = result.tools.map((tool: any) => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema || { type: 'object', properties: {} }
      }));
    } catch (error) {
      logger.error(`Failed to discover tools from ${this.config.name}:`, error);
      this.tools = [];
    }
  }
  
  /**
   * Discover available prompts from the MCP server
   */
  private async discoverPrompts(): Promise<void> {
    try {
      const result = await this.client.listPrompts();
      this.prompts = result.prompts.map((prompt: any) => ({
        name: prompt.name,
        description: prompt.description || '',
        arguments: prompt.arguments || []
      }));
    } catch (error) {
      logger.error(`Failed to discover prompts from ${this.config.name}:`, error);
      this.prompts = [];
    }
  }
  
  /**
   * Get available tools
   */
  getTools(): MCPTool[] {
    return this.tools;
  }
  
  /**
   * Get available prompts
   */
  getPrompts(): MCPPrompt[] {
    return this.prompts;
  }
  
  /**
   * Get a prompt with filled arguments
   */
  async getPrompt(promptName: string, args: Record<string, string>): Promise<MCPPromptResult | null> {
    if (!this.connected) {
      logger.error(`Cannot get prompt: not connected to ${this.config.name}`);
      return null;
    }
    
    try {
      logger.info(`Getting prompt ${promptName} from ${this.config.name}`);
      const result = await this.client.getPrompt({
        name: promptName,
        arguments: args
      });
      
      return {
        description: result.description,
        messages: result.messages || []
      };
    } catch (error) {
      logger.error(`Error getting prompt ${promptName}:`, error);
      return null;
    }
  }
  
  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Call a tool on the MCP server
   */
  async callTool(toolName: string, toolInput: any): Promise<MCPClientResponse> {
    if (!this.connected) {
      return {
        success: false,
        error: 'Not connected to MCP server'
      };
    }
    
    try {
      logger.info(`Calling tool ${toolName} on ${this.config.name}`);
      logger.debug(`Tool input:`, toolInput);
      
      const result = await this.client.callTool({
        name: toolName,
        arguments: toolInput
      });
      
      logger.debug(`Tool result:`, result);
      
      return {
        success: true,
        data: result
      };
    } catch (error) {
      logger.error(`Error calling tool ${toolName}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Disconnect from the MCP server
   */
  async disconnect(): Promise<void> {
    if (this.connected && this.client) {
      try {
        await this.client.close();
        this.connected = false;
        logger.info(`Disconnected from ${this.config.name}`);
      } catch (error) {
        logger.error(`Error disconnecting from ${this.config.name}:`, error);
      }
    }
  }
}

/**
 * MCP Client Manager
 * Manages connections to multiple MCP servers
 */
export class MCPClientManager {
  private clients: Map<string, MCPClient> = new Map();
  private serverConfigs: MCPServerConfig[] = [];
  
  /**
   * Initialize with server configurations
   * Disconnects existing clients and creates new ones
   */
  async initialize(configs: MCPServerConfig[]): Promise<void> {
    // Disconnect all existing clients first
    if (this.clients.size > 0) {
      logger.info(`Disconnecting ${this.clients.size} existing MCP clients before reinitializing`);
      await this.disconnectAll();
    }
    
    this.serverConfigs = configs;
    
    logger.info(`Initializing MCP clients for ${configs.length} servers`);
    
    // Connect to all servers
    const connectionPromises = configs.map(async (config) => {
      const client = new MCPClient(config);
      try {
        await client.connect();
        this.clients.set(config.name, client);
      } catch (error) {
        logger.error(`Failed to initialize client for ${config.name}:`, error);
      }
    });
    
    await Promise.allSettled(connectionPromises);
    
    logger.info(`Initialized ${this.clients.size} MCP clients`);
  }
  
  /**
   * Get all available tools from all connected servers
   */
  getAllTools(): Array<MCPTool & { server: string }> {
    const allTools: Array<MCPTool & { server: string }> = [];
    
    for (const [serverName, client] of this.clients.entries()) {
      if (client.isConnected()) {
        const tools = client.getTools();
        tools.forEach(tool => {
          allTools.push({
            ...tool,
            server: serverName
          });
        });
      }
    }
    
    return allTools;
  }
  
  /**
   * Get all available prompts from all connected servers
   */
  getAllPrompts(): Array<MCPPrompt & { server: string }> {
    const allPrompts: Array<MCPPrompt & { server: string }> = [];
    
    for (const [serverName, client] of this.clients.entries()) {
      if (client.isConnected()) {
        const prompts = client.getPrompts();
        prompts.forEach(prompt => {
          allPrompts.push({
            ...prompt,
            server: serverName
          });
        });
      }
    }
    
    return allPrompts;
  }
  
  /**
   * Get a prompt from a specific server
   */
  async getPrompt(serverName: string, promptName: string, args: Record<string, string>): Promise<MCPPromptResult | null> {
    const client = this.clients.get(serverName);
    if (!client) {
      logger.error(`Server ${serverName} not found`);
      return null;
    }
    
    return client.getPrompt(promptName, args);
  }
  
  /**
   * Find which server has a specific tool
   */
  findServerForTool(toolName: string): string | null {
    for (const [serverName, client] of this.clients.entries()) {
      if (client.isConnected()) {
        const tools = client.getTools();
        if (tools.some(tool => tool.name === toolName)) {
          return serverName;
        }
      }
    }
    return null;
  }
  
  /**
   * Call a tool on the appropriate server
   */
  async callTool(toolName: string, toolInput: any, serverName?: string): Promise<MCPClientResponse> {
    // If server name is provided, use that server
    if (serverName) {
      const client = this.clients.get(serverName);
      if (!client) {
        return {
          success: false,
          error: `Server ${serverName} not found`
        };
      }
      return client.callTool(toolName, toolInput);
    }
    
    // Otherwise, find the server that has this tool
    const foundServer = this.findServerForTool(toolName);
    if (!foundServer) {
      return {
        success: false,
        error: `Tool ${toolName} not found on any connected server`
      };
    }
    
    const client = this.clients.get(foundServer);
    if (!client) {
      return {
        success: false,
        error: `Server ${foundServer} not available`
      };
    }
    
    return client.callTool(toolName, toolInput);
  }
  
  /**
   * Get server status
   */
  getServerStatus(): Array<{
    name: string;
    transport: string;
    url?: string;
    command?: string;
    connected: boolean;
    toolCount: number;
  }> {
    return this.serverConfigs.map(config => {
      const client = this.clients.get(config.name);
      return {
        name: config.name,
        transport: config.transport,
        url: config.url,
        command: config.command,
        connected: client?.isConnected() || false,
        toolCount: client?.getTools().length || 0
      };
    });
  }
  
  /**
   * Disconnect all clients
   */
  async disconnectAll(): Promise<void> {
    logger.info('Disconnecting all MCP clients');
    
    const disconnectPromises = Array.from(this.clients.values()).map(client =>
      client.disconnect()
    );
    
    await Promise.allSettled(disconnectPromises);
    this.clients.clear();
  }
}

// Singleton instance
export const mcpClientManager = new MCPClientManager();

// Made with Bob
