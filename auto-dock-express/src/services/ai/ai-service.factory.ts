/**
 * AI Service Factory
 * Creates the appropriate AI service based on configuration
 */

import { AIProvider, AIProviderConfig, IAIService } from '../../types';
import { ClaudeAIService } from './claude-ai.service';
import { OpenAIAIService } from './openai-ai.service';
import { BedrockAIService } from './bedrock-ai.service';
import { BobAIService } from './bob-ai.service';
import { OllamaAIService } from './ollama-ai.service';
import { logger } from '../../utils/logger';

export class AIServiceFactory {
  /**
   * Create an AI service instance based on provider configuration
   */
  static createService(config: AIProviderConfig): IAIService {
    logger.info(`Creating AI service for provider: ${config.provider}`);
    
    switch (config.provider) {
      case 'claude':
        return new ClaudeAIService(
          config.apiKey,
          config.model,
          config.maxTokens,
          config.temperature
        );
      
      case 'openai':
        return new OpenAIAIService(
          config.apiKey,
          config.model,
          config.maxTokens,
          config.temperature,
          config.baseURL
        );
      
      case 'bedrock':
        // Bedrock accepts runtime credentials or falls back to environment/IAM
        return new BedrockAIService(
          config.region,
          config.accessKeyId,
          config.secretAccessKey,
          config.model,
          config.maxTokens,
          config.temperature
        );
      
      case 'bob':
        // Bob uses OpenAI-compatible API with Bob's endpoint
        return new BobAIService(
          config.apiKey,
          config.model,
          config.maxTokens,
          config.temperature
        );
      
      case 'ollama':
        // Ollama uses local models with OpenAI-compatible API
        return new OllamaAIService(
          config.model,
          config.maxTokens,
          config.temperature,
          config.baseURL || 'http://localhost:11434/v1'
        );
      
      case 'custom':
        // For custom providers, use OpenAI-compatible API
        if (!config.baseURL) {
          throw new Error('Custom provider requires baseURL');
        }
        return new OpenAIAIService(
          config.apiKey,
          config.model,
          config.maxTokens,
          config.temperature,
          config.baseURL
        );
      
      default:
        throw new Error(`Unsupported AI provider: ${config.provider}`);
    }
  }
  
  /**
   * Create service from environment variables
   */
  static createFromEnv(): IAIService {
    const provider = (process.env.AI_PROVIDER || 'claude') as AIProvider;
    
    const config: AIProviderConfig = {
      provider,
      apiKey: '',
      model: '',
      maxTokens: 4096,
      temperature: 0.7
    };
    
    switch (provider) {
      case 'claude':
        config.apiKey = process.env.ANTHROPIC_API_KEY || '';
        config.model = process.env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022';
        config.maxTokens = parseInt(process.env.CLAUDE_MAX_TOKENS || '4096');
        config.temperature = parseFloat(process.env.CLAUDE_TEMPERATURE || '0.7');
        break;
      
      case 'openai':
        config.apiKey = process.env.OPENAI_API_KEY || '';
        config.model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';
        config.maxTokens = parseInt(process.env.OPENAI_MAX_TOKENS || '4096');
        config.temperature = parseFloat(process.env.OPENAI_TEMPERATURE || '0.7');
        break;
      
      case 'bedrock':
        // Bedrock uses AWS credentials from environment or IAM role
        config.region = process.env.AWS_REGION || 'us-east-1';
        config.model = process.env.BEDROCK_MODEL_ID || 'anthropic.claude-3-5-sonnet-20241022-v2:0';
        config.maxTokens = parseInt(process.env.BEDROCK_MAX_TOKENS || '4096');
        config.temperature = parseFloat(process.env.BEDROCK_TEMPERATURE || '0.7');
        // AWS credentials are handled by the SDK
        config.apiKey = 'bedrock'; // Placeholder, not used
        break;
      
      case 'bob':
        config.apiKey = process.env.BOB_API_KEY || '';
        config.model = process.env.BOB_MODEL || 'claude-3-7-sonnet-20250219';
        config.maxTokens = parseInt(process.env.BOB_MAX_TOKENS || '200000');
        config.temperature = parseFloat(process.env.BOB_TEMPERATURE || '0.7');
        break;
      
      case 'ollama':
        config.model = process.env.OLLAMA_MODEL || 'llama2';
        config.baseURL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
        config.maxTokens = parseInt(process.env.OLLAMA_MAX_TOKENS || '4096');
        config.temperature = parseFloat(process.env.OLLAMA_TEMPERATURE || '0.7');
        config.apiKey = 'ollama'; // Placeholder, not used
        break;
      
      case 'custom':
        config.apiKey = process.env.CUSTOM_AI_API_KEY || '';
        config.model = process.env.CUSTOM_AI_MODEL || 'custom-model';
        config.baseURL = process.env.CUSTOM_AI_BASE_URL;
        config.maxTokens = 4096;
        config.temperature = 0.7;
        break;
    }
    
    if (!config.apiKey && provider !== 'custom' && provider !== 'bedrock' && provider !== 'bob' && provider !== 'ollama') {
      throw new Error(`API key not configured for provider: ${provider}`);
    }
    
    return this.createService(config);
  }
}

// Made with Bob
