/**
 * AWS Bedrock AI Service
 * Implements IAIService for AWS Bedrock (Claude models via Bedrock)
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
  InvokeModelCommandInput,
} from '@aws-sdk/client-bedrock-runtime';
import { BaseAIService } from './base-ai.service';
import {
  AIMessage,
  AITool,
  AIServiceResponse,
  ChatOptions,
  ClaudeMessage,
  ClaudeContent,
  ClaudeTool,
} from '../../types';
import { logger } from '../../utils/logger';

export class BedrockAIService extends BaseAIService {
  provider = 'bedrock' as const;
  private client: BedrockRuntimeClient;
  private modelId: string;
  private maxTokens: number;
  private temperature: number;

  constructor(
    region?: string,
    accessKeyId?: string,
    secretAccessKey?: string,
    modelId?: string,
    maxTokens?: number,
    temperature?: number
  ) {
    super();

    const awsRegion = region || process.env.AWS_REGION || 'us-east-1';
    const awsAccessKeyId = accessKeyId || process.env.AWS_ACCESS_KEY_ID;
    const awsSecretAccessKey = secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY;

    // Initialize Bedrock client
    this.client = new BedrockRuntimeClient({
      region: awsRegion,
      credentials: awsAccessKeyId && awsSecretAccessKey
        ? {
            accessKeyId: awsAccessKeyId,
            secretAccessKey: awsSecretAccessKey,
          }
        : undefined, // Use default credential chain if not provided
    });

    this.modelId = modelId || process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
    this.maxTokens = maxTokens || parseInt(process.env.BEDROCK_MAX_TOKENS || '4096');
    this.temperature = temperature ?? parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7');

    logger.info('Bedrock AI Service initialized', {
      region: awsRegion,
      modelId: this.modelId,
    });
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
      // Convert unified messages to Claude format
      const claudeMessages = this.convertToClaudeMessages(messages);

      // Convert unified tools to Claude format
      const claudeTools = tools ? this.convertToClaudeTools(tools) : undefined;

      // Prepare request body for Bedrock
      const requestBody: any = {
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: options?.maxTokens || this.maxTokens,
        temperature: options?.temperature ?? this.temperature,
        messages: claudeMessages,
      };

      if (claudeTools && claudeTools.length > 0) {
        requestBody.tools = claudeTools;
      }

      // Extract system message if present
      const systemMessage = messages.find(m => m.role === 'system');
      if (systemMessage && typeof systemMessage.content === 'string') {
        requestBody.system = systemMessage.content;
      }

      logger.debug('Bedrock request', {
        modelId: this.modelId,
        messageCount: claudeMessages.length,
        toolCount: claudeTools?.length || 0,
      });

      // Invoke Bedrock model
      const command = new InvokeModelCommand({
        modelId: this.modelId,
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(requestBody),
      });

      const response = await this.client.send(command);

      // Parse response
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));

      logger.debug('Bedrock response', {
        stopReason: responseBody.stop_reason,
        usage: responseBody.usage,
      });

      // Extract message content
      let message = '';
      const toolCalls: { id: string; name: string; input: any }[] = [];

      for (const content of responseBody.content) {
        if (content.type === 'text') {
          message += content.text;
        } else if (content.type === 'tool_use') {
          toolCalls.push({
            id: content.id,
            name: content.name,
            input: content.input,
          });
        }
      }

      // Determine finish reason
      let finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error' = 'stop';
      if (responseBody.stop_reason === 'tool_use') {
        finishReason = 'tool_use';
      } else if (responseBody.stop_reason === 'max_tokens') {
        finishReason = 'max_tokens';
      }

      return {
        message,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        finishReason,
        usage: {
          inputTokens: responseBody.usage?.input_tokens || 0,
          outputTokens: responseBody.usage?.output_tokens || 0,
        },
      };
    } catch (error) {
      logger.error('Bedrock chat error:', error);
      throw error;
    }
  }

  /**
   * Convert unified messages to Claude format
   */
  private convertToClaudeMessages(messages: AIMessage[]): ClaudeMessage[] {
    return messages
      .filter(m => m.role !== 'system') // System messages handled separately
      .map(msg => {
        if (typeof msg.content === 'string') {
          return {
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          };
        }

        // Convert content array
        const claudeContent: ClaudeContent[] = msg.content.map(c => {
          if (c.type === 'text') {
            return { type: 'text', text: c.text || '' };
          } else if (c.type === 'tool_use') {
            return {
              type: 'tool_use',
              id: c.id || '',
              name: c.name || '',
              input: c.input || {},
            };
          } else if (c.type === 'tool_result') {
            return {
              type: 'tool_result',
              tool_use_id: c.tool_use_id || '',
              content: c.content || '',
            };
          }
          return { type: 'text', text: '' };
        });

        return {
          role: msg.role as 'user' | 'assistant',
          content: claudeContent,
        };
      });
  }

  /**
   * Convert unified tools to Claude format
   */
  private convertToClaudeTools(tools: AITool[]): ClaudeTool[] {
    return tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema,
    }));
  }
}

// Made with Bob
