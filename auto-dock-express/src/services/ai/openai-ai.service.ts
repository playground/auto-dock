/**
 * OpenAI AI Service Implementation
 * Uses OpenAI's GPT models
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

export class OpenAIAIService extends BaseAIService {
  provider: AIProvider = 'openai';
  private client: OpenAI;
  private model: string;
  private defaultMaxTokens: number;
  private defaultTemperature: number;
  
  constructor(
    apiKey: string,
    model: string = 'gpt-4-turbo-preview',
    maxTokens: number = 4096,
    temperature: number = 0.7,
    baseURL?: string
  ) {
    super();
    this.client = new OpenAI({
      apiKey,
      baseURL
    });
    this.model = model;
    this.defaultMaxTokens = maxTokens;
    this.defaultTemperature = temperature;
    
    logger.info(`OpenAI AI Service initialized with model: ${model}`);
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
      logger.info(`Sending chat request to OpenAI`);
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
      
      logger.info(`Received response from OpenAI`);
      logger.debug(`Response:`, response);
      
      // Parse response
      return this.parseOpenAIResponse(response);
    } catch (error) {
      logger.error(`Error in OpenAI chat:`, error);
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
      
      // Handle complex content
      const openaiMessage: OpenAIMessage = {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: null
      };
      
      // Extract text content
      const textContent = msg.content
        .filter(c => c.type === 'text')
        .map(c => c.text)
        .join('\n');
      
      if (textContent) {
        openaiMessage.content = textContent;
      }
      
      // Handle function/tool calls
      const toolCalls = msg.content.filter(c => c.type === 'tool_use' || c.type === 'function_call');
      if (toolCalls.length > 0) {
        openaiMessage.tool_calls = toolCalls.map((tc, index) => ({
          id: tc.id || `call_${index}`,
          type: 'function' as const,
          function: {
            name: tc.name || tc.function_call?.name || '',
            arguments: JSON.stringify(tc.input || tc.function_call?.arguments || {})
          }
        }));
      }
      
      // Handle tool results
      const toolResults = msg.content.filter(c => c.type === 'tool_result' || c.type === 'function_result');
      if (toolResults.length > 0 && toolResults[0]) {
        openaiMessage.role = 'tool';
        openaiMessage.tool_call_id = toolResults[0].tool_use_id || '';
        openaiMessage.content = typeof toolResults[0].content === 'string' 
          ? toolResults[0].content 
          : JSON.stringify(toolResults[0].content);
      }
      
      return openaiMessage;
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
    const message = choice?.message;
    
    let messageText = message?.content || '';
    const toolCalls: Array<{ id: string; name: string; input: any }> = [];
    
    // Extract tool calls
    if (message?.tool_calls && Array.isArray(message.tool_calls)) {
      for (const toolCall of message.tool_calls) {
        if (toolCall.type === 'function') {
          try {
            const input = JSON.parse(toolCall.function.arguments);
            toolCalls.push({
              id: toolCall.id,
              name: toolCall.function.name,
              input
            });
          } catch (error) {
            logger.error(`Failed to parse tool call arguments:`, error);
          }
        }
      }
    }
    
    // Determine finish reason
    let finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error' = 'stop';
    if (choice?.finish_reason === 'tool_calls') {
      finishReason = 'tool_use';
    } else if (choice?.finish_reason === 'length') {
      finishReason = 'max_tokens';
    }
    
    return {
      message: messageText,
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
