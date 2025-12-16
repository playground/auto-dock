/**
 * Claude AI Service Implementation
 * Uses Anthropic's Claude API
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  AIProvider,
  AIMessage,
  AITool,
  ChatOptions,
  AIServiceResponse,
  ClaudeMessage,
  ClaudeContent,
  ClaudeTool
} from '../../types';
import { BaseAIService } from './base-ai.service';
import { logger } from '../../utils/logger';

export class ClaudeAIService extends BaseAIService {
  provider: AIProvider = 'claude';
  private client: Anthropic;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  
  constructor(
    apiKey: string,
    model: string = 'claude-3-5-sonnet-20241022',
    maxTokens: number = 4096,
    temperature: number = 0.7
  ) {
    super();
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.defaultMaxTokens = maxTokens;
    this.defaultTemperature = temperature;
    
    logger.info(`Claude AI Service initialized with model: ${model}`);
  }
  
  /**
   * Send a chat message and get a response
   */
  async chat(
    messages: AIMessage[],
    tools?: AITool[],
    options?: ChatOptions
  ): Promise<AIServiceResponse> {
    try {
      logger.info(`Sending chat request to Claude`);
      logger.debug(`Messages:`, messages);
      logger.debug(`Tools:`, tools);
      
      // Convert AI messages to Claude format
      const claudeMessages = this.convertToClaudeMessages(messages);
      
      // Convert AI tools to Claude format
      const claudeTools = tools ? this.convertToClaudeTools(tools) : undefined;
      
      // Prepare request parameters
      const requestParams: any = {
        model: this.model,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        temperature: options?.temperature || this.defaultTemperature,
        messages: claudeMessages
      };
      
      if (claudeTools && claudeTools.length > 0) {
        requestParams.tools = claudeTools;
      }
      
      // Make API call
      const response = await this.client.messages.create(requestParams);
      
      logger.info(`Received response from Claude`);
      logger.debug(`Response:`, response);
      
      // Parse response
      return this.parseClaudeResponse(response);
    } catch (error) {
      logger.error(`Error in Claude chat:`, error);
      throw error;
    }
  }
  
  /**
   * Convert AI messages to Claude format
   */
  private convertToClaudeMessages(messages: AIMessage[]): ClaudeMessage[] {
    return messages
      .filter(msg => msg.role !== 'system') // Claude handles system messages separately
      .map(msg => {
        if (typeof msg.content === 'string') {
          return {
            role: msg.role as 'user' | 'assistant',
            content: msg.content
          };
        }
        
        // Handle complex content
        const claudeContent: ClaudeContent[] = msg.content.map(content => {
          if (content.type === 'text') {
            return {
              type: 'text',
              text: content.text || ''
            };
          } else if (content.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: content.id || '',
              name: content.name || '',
              input: content.input || {}
            };
          } else if (content.type === 'tool_result') {
            return {
              type: 'tool_result',
              tool_use_id: content.tool_use_id || '',
              content: content.content || ''
            };
          }
          
          return {
            type: 'text',
            text: JSON.stringify(content)
          };
        });
        
        return {
          role: msg.role as 'user' | 'assistant',
          content: claudeContent
        };
      });
  }
  
  /**
   * Convert AI tools to Claude format
   */
  private convertToClaudeTools(tools: AITool[]): ClaudeTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }));
  }
  
  /**
   * Parse Claude API response
   */
  private parseClaudeResponse(response: any): AIServiceResponse {
    let message = '';
    const toolCalls: Array<{ id: string; name: string; input: any }> = [];
    
    // Extract content
    if (Array.isArray(response.content)) {
      for (const content of response.content) {
        if (content.type === 'text') {
          message += content.text;
        } else if (content.type === 'tool_use') {
          toolCalls.push({
            id: content.id,
            name: content.name,
            input: content.input
          });
        }
      }
    }
    
    // Determine finish reason
    let finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error' = 'stop';
    if (response.stop_reason === 'tool_use') {
      finishReason = 'tool_use';
    } else if (response.stop_reason === 'max_tokens') {
      finishReason = 'max_tokens';
    }
    
    return {
      message: message.trim(),
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage: {
        inputTokens: response.usage?.input_tokens || 0,
        outputTokens: response.usage?.output_tokens || 0
      }
    };
  }
}

// Made with Bob
