/**
 * Agent Service
 * Main orchestrator that coordinates AI service and MCP clients
 */

import {
  QueryRequest,
  AgentResponse,
  AIMessage,
  AITool,
  ToolExecution,
  MCPServerConfig
} from '../types';
import { IAIService } from '../types';
import { mcpClientManager } from './mcp-client.service';
import { logger } from '../utils/logger';
import { randomUUID } from 'crypto';
import { SYSTEM_PROMPT } from './system-prompt';

export class AgentService {
  private aiService: IAIService;
  private mcpServers: MCPServerConfig[];
  private conversationHistory: Map<string, AIMessage[]> = new Map();
  
  constructor(aiService: IAIService, mcpServers: MCPServerConfig[]) {
    this.aiService = aiService;
    this.mcpServers = mcpServers;
    
    logger.info(`Agent Service initialized with ${aiService.provider} provider`);
  }
  
  /**
   * Process a user query
   */
  async processQuery(request: QueryRequest): Promise<AgentResponse> {
    const conversationId = request.conversationId || randomUUID();
    const startTime = Date.now();
    
    try {
      logger.info(`Processing query for conversation: ${conversationId}`);
      logger.debug(`Query:`, request.message);
      
      // Get or create conversation history
      let messages = this.conversationHistory.get(conversationId) || [];
      
      // Add system prompt if this is a new conversation
      if (messages.length === 0) {
        messages.push({
          role: 'system',
          content: SYSTEM_PROMPT
        });
      }
      
      // Add context if provided
      if (request.context && request.context.length > 0) {
        // Preserve system message if it exists
        const systemMessage = messages.find(m => m.role === 'system');
        messages = request.context.map(ctx => ({
          role: ctx.role,
          content: ctx.content
        }));
        // Re-add system message at the beginning
        if (systemMessage) {
          messages.unshift(systemMessage);
        }
      }
      
      // Add user message
      messages.push({
        role: 'user',
        content: request.message
      });
      
      // Get available tools from MCP servers
      const availableTools = mcpClientManager.getAllTools();
      
      // Filter and prioritize tools for Ollama and other smaller models
      // Bedrock/Claude handle tool selection well, so skip filtering for them
      const shouldFilterTools = this.aiService.provider === 'ollama' || this.aiService.provider === 'openai';
      const filteredTools = shouldFilterTools
        ? this.filterAndPrioritizeTools(availableTools)
        : availableTools;
      
      const aiTools: AITool[] = filteredTools.map(tool => ({
        name: tool.name,
        description: `${tool.description} (Server: ${tool.server})`,
        input_schema: tool.inputSchema
      }));
      
      if (shouldFilterTools && filteredTools.length < availableTools.length) {
        logger.info(`Available tools: ${aiTools.length} (filtered from ${availableTools.length} for ${this.aiService.provider})`);
      } else {
        logger.info(`Available tools: ${aiTools.length}`);
      }
      logger.debug(`Tool names: ${aiTools.map(t => t.name).join(', ')}`);
      
      // Initial AI response
      let aiResponse = await this.aiService.chat(messages, aiTools);
      
      const toolExecutions: ToolExecution[] = [];
      let finalMessage = aiResponse.message;
      
      // Handle tool calls iteratively
      while (aiResponse.finishReason === 'tool_use' && aiResponse.toolCalls) {
        logger.info(`AI requested ${aiResponse.toolCalls.length} tool calls`);
        
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: [
            ...(aiResponse.message ? [{ type: 'text' as const, text: aiResponse.message }] : []),
            ...aiResponse.toolCalls.map(tc => ({
              type: 'tool_use' as const,
              id: tc.id,
              name: tc.name,
              input: tc.input
            }))
          ]
        });
        
        // Execute each tool call
        const toolResults = await Promise.all(
          aiResponse.toolCalls.map(async (toolCall) => {
            const execution = await this.aiService.executeToolCall(
              toolCall.name,
              toolCall.input,
              this.mcpServers
            );
            
            toolExecutions.push(execution);
            
            return {
              id: toolCall.id,
              result: execution.success ? execution.output : { error: execution.error }
            };
          })
        );
        
        // Add tool results to messages
        messages.push({
          role: 'user',
          content: toolResults.map(tr => ({
            type: 'tool_result' as const,
            tool_use_id: tr.id,
            content: JSON.stringify(tr.result)
          }))
        });
        
        // Get next AI response
        aiResponse = await this.aiService.chat(messages, aiTools);
        finalMessage = aiResponse.message;
      }
      
      // Add final assistant message
      messages.push({
        role: 'assistant',
        content: finalMessage
      });
      
      // Update conversation history
      this.conversationHistory.set(conversationId, messages);
      
      // Clean up old conversations (keep last 50)
      if (this.conversationHistory.size > 50) {
        const oldestKey = this.conversationHistory.keys().next().value;
        if (oldestKey) {
          this.conversationHistory.delete(oldestKey);
        }
      }
      
      const response: AgentResponse = {
        message: finalMessage,
        toolsUsed: toolExecutions.length > 0 ? toolExecutions : undefined,
        conversationId,
        timestamp: new Date().toISOString(),
        provider: this.aiService.provider,
        model: process.env.AI_PROVIDER === 'claude' 
          ? process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022'
          : process.env.OPENAI_MODEL || 'gpt-4-turbo-preview'
      };
      
      logger.info(`Query processed in ${Date.now() - startTime}ms`);
      logger.debug(`Response:`, response);
      
      return response;
    } catch (error) {
      logger.error(`Error processing query:`, error);
      throw error;
    }
  }
  
  /**
   * Get conversation history
   */
  getConversationHistory(conversationId: string): AIMessage[] | undefined {
    return this.conversationHistory.get(conversationId);
  }
  
  /**
   * Clear conversation history
   */
  clearConversationHistory(conversationId: string): void {
    this.conversationHistory.delete(conversationId);
    logger.info(`Cleared conversation history: ${conversationId}`);
  }
  
  /**
   * Clear all conversation histories
   */
  clearAllConversations(): void {
    this.conversationHistory.clear();
    logger.info(`Cleared all conversation histories`);
  }
  
  /**
   * Filter and prioritize tools for better selection with smaller models
   * Prioritizes domain-specific tools (auto-dock) over generic API tools
   */
  private filterAndPrioritizeTools(tools: Array<any>): Array<any> {
    // Separate tools by server
    const autoDockTools = tools.filter(t => t.server === 'auto-dock-mcp-server');
    const otherTools = tools.filter(t => t.server !== 'auto-dock-mcp-server');
    
    // List of generic tool names to exclude when auto-dock alternatives exist
    const genericToolsToExclude = ['api-query', 'swagger-query', 'rest-api', 'http-request'];
    
    // Filter out generic tools if we have auto-dock tools
    const filteredOtherTools = autoDockTools.length > 0
      ? otherTools.filter(t => !genericToolsToExclude.includes(t.name))
      : otherTools;
    
    // Return auto-dock tools first (higher priority), then other tools
    const result = [...autoDockTools, ...filteredOtherTools];
    
    logger.debug(`Tool filtering: ${tools.length} total, ${autoDockTools.length} auto-dock, ${filteredOtherTools.length} other, ${tools.length - result.length} excluded`);
    
    return result;
  }
}

// Made with Bob
