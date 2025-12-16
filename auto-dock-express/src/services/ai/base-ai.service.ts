/**
 * Base AI Service Interface
 * Defines the contract for all AI provider implementations
 */

import {
  IAIService,
  AIProvider,
  AIMessage,
  AITool,
  ChatOptions,
  AIServiceResponse,
  ToolExecution,
  MCPServerConfig
} from '../../types';
import { mcpClientManager } from '../mcp-client.service';
import { logger } from '../../utils/logger';

/**
 * Abstract base class for AI services
 */
export abstract class BaseAIService implements IAIService {
  abstract provider: AIProvider;
  
  /**
   * Send a chat message and get a response
   */
  abstract chat(
    messages: AIMessage[],
    tools?: AITool[],
    options?: ChatOptions
  ): Promise<AIServiceResponse>;
  
  /**
   * Execute a tool call via MCP
   */
  async executeToolCall(
    toolName: string,
    toolInput: any,
    mcpServers: MCPServerConfig[]
  ): Promise<ToolExecution> {
    const startTime = Date.now();
    
    try {
      logger.info(`Executing tool: ${toolName}`);
      logger.debug(`Tool input:`, toolInput);
      
      // Find which server has this tool
      const serverName = mcpClientManager.findServerForTool(toolName);
      
      if (!serverName) {
        return {
          toolName,
          server: 'unknown',
          input: toolInput,
          output: null,
          success: false,
          error: `Tool ${toolName} not found on any connected MCP server`,
          executionTime: Date.now() - startTime
        };
      }
      
      // Call the tool
      const result = await mcpClientManager.callTool(toolName, toolInput, serverName);
      
      if (!result.success) {
        return {
          toolName,
          server: serverName,
          input: toolInput,
          output: null,
          success: false,
          error: result.error || 'Unknown error',
          executionTime: Date.now() - startTime
        };
      }
      
      logger.info(`Tool ${toolName} executed successfully`);
      logger.debug(`Tool output:`, result.data);
      
      return {
        toolName,
        server: serverName,
        input: toolInput,
        output: result.data,
        success: true,
        executionTime: Date.now() - startTime
      };
    } catch (error) {
      logger.error(`Error executing tool ${toolName}:`, error);
      
      return {
        toolName,
        server: 'unknown',
        input: toolInput,
        output: null,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime: Date.now() - startTime
      };
    }
  }
  
  /**
   * Convert MCP tools to AI provider format
   */
  protected convertMCPToolsToAITools(mcpTools: Array<any>): AITool[] {
    return mcpTools.map(tool => ({
      name: tool.name,
      description: tool.description || `Tool: ${tool.name}`,
      input_schema: tool.inputSchema || {
        type: 'object',
        properties: {},
        required: []
      }
    }));
  }
  
  /**
   * Format tool execution results for AI context
   */
  protected formatToolResult(execution: ToolExecution): string {
    if (!execution.success) {
      return `Error executing ${execution.toolName}: ${execution.error}`;
    }
    
    // Format the output nicely
    if (typeof execution.output === 'object') {
      return JSON.stringify(execution.output, null, 2);
    }
    
    return String(execution.output);
  }
}

// Made with Bob
