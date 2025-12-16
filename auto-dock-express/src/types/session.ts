import 'express-session';
import { AIProvider } from './index';
import { ParsedMcpServer } from './mcp-config.types';

// Extend express-session to include our custom session data
declare module 'express-session' {
  interface SessionData {
    credentials?: {
      provider: AIProvider;
      apiKey?: string;
      model?: string;
      maxTokens?: number;
      temperature?: number;
      // AWS Bedrock specific
      region?: string;
      accessKeyId?: string;
      secretAccessKey?: string;
      // OpenAI/Custom specific
      baseURL?: string;
    };
    // MCP server configuration
    mcpServers?: ParsedMcpServer[];
  }
}

export interface CredentialsRequest {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  // AWS Bedrock specific
  region?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  // OpenAI/Custom specific
  baseURL?: string;
}

// Made with Bob