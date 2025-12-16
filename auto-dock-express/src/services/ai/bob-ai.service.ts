/**
 * Bob AI Service Implementation
 * Uses Bob's OpenAI-compatible API
 */

import OpenAI from 'openai';
import {
  AIProvider,
  AIMessage,
  AITool,
  ChatOptions,
  AIServiceResponse,
  OpenAIMessage,
  OpenAITool
} from '../../types';
import { BaseAIService } from './base-ai.service';
import { logger } from '../../utils/logger';

export class BobAIService extends BaseAIService {
  provider: AIProvider = 'bob';
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  
  constructor(
    apiKey: string,
    model: string = 'claude-3-7-sonnet-20250219',
    maxTokens: number = 200000,
    temperature: number = 0.7
  ) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL: 'https://api.bob.build/v1'
    });
    this.model = model;
    this.defaultMaxTokens = maxTokens;
    this.defaultTemperature = temperature;
    
    logger.info(`Bob AI Service initialized with model: ${model}`);
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
      logger.info(`Sending chat request to Bob`);
      logger.debug(`Messages:`, messages);
      logger.debug(`Tools:`, tools);
      
      // Convert AI messages to OpenAI format
      const openaiMessages = this.convertToOpenAIMessages(messages);
      
      // Convert AI tools to OpenAI format
      const openaiTools = tools ? this.convertToOpenAITools(tools) : undefined;
      
      // Prepare request parameters
      const requestParams: any = {
        model: this.model,
        messages: openaiMessages,
        max_tokens: options?.maxTokens || this.defaultMaxTokens,
        temperature: options?.temperature || this.defaultTemperature
      };
      
      if (openaiTools && openaiTools.length > 0) {
        requestParams.tools = openaiTools;
        requestParams.tool_choice = 'auto';
      }
      
      // Make API call
      const response = await this.client.chat.completions.create(requestParams);
      
      logger.info(`Received response from Bob`);
      logger.debug(`Response:`, response);
      
      // Parse response
      return this.parseOpenAIResponse(response);
    } catch (error) {
      logger.error(`Error in Bob chat:`, error);
      throw error;
    }
  }
  
  /**
   * Convert AI messages to OpenAI format
   */
  private convertToOpenAIMessages(messages: AIMessage[]): OpenAIMessage[] {
    return messages.map(msg => {
      if (typeof msg.content === 'string') {
        return {
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content
        };
      }
      
      // Handle complex content with tool calls
      const hasToolUse = msg.content.some(c => c.type === 'tool_use');
      const hasToolResult = msg.content.some(c => c.type === 'tool_result');
      
      if (hasToolResult) {
        // This is a tool result message
        const toolResult = msg.content.find(c => c.type === 'tool_result');
        return {
          role: 'tool',
          content: typeof toolResult?.content === 'string' 
            ? toolResult.content 
            : JSON.stringify(toolResult?.content),
          tool_call_id: toolResult?.tool_use_id || ''
        };
      }
      
      if (hasToolUse) {
        // This is an assistant message with tool calls
        const textContent = msg.content.find(c => c.type === 'text');
        const toolCalls = msg.content
          .filter(c => c.type === 'tool_use')
          .map(c => ({
            id: c.id || '',
            type: 'function' as const,
            function: {
              name: c.name || '',
              arguments: JSON.stringify(c.input || {})
            }
          }));
        
        return {
          role: 'assistant',
          content: textContent?.text || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined
        };
      }
      
      // Default: concatenate text content
      const textContent = msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: textContent
      };
    });
  }
  
  /**
   * Convert AI tools to OpenAI format
   */
  private convertToOpenAITools(tools: AITool[]): OpenAITool[] {
    return tools.map(tool => ({
      type: 'function',
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.input_schema
      }
    }));
  }
  
  /**
   * Parse OpenAI API response
   */
  private parseOpenAIResponse(response: any): AIServiceResponse {
    const choice = response.choices[0];
    const message = choice.message;
    
    let responseMessage = message.content || '';
    const toolCalls: Array<{ id: string; name: string; input: any }> = [];
    
    // Extract tool calls if present
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        try {
          toolCalls.push({
            id: toolCall.id,
            name: toolCall.function.name,
            input: JSON.parse(toolCall.function.arguments)
          });
        } catch (error) {
          logger.error(`Error parsing tool call arguments:`, error);
        }
      }
    }
    
    // Determine finish reason
    let finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error' = 'stop';
    if (choice.finish_reason === 'tool_calls') {
      finishReason = 'tool_use';
    } else if (choice.finish_reason === 'length') {
      finishReason = 'max_tokens';
    }
    
    return {
      message: responseMessage,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      finishReason,
      usage: {
        inputTokens: response.usage?.prompt_tokens || 0,
        outputTokens: response.usage?.completion_tokens || 0
      }
    };
  }
}

// Made with Bob