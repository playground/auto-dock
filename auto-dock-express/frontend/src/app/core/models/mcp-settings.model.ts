export enum MCPServerType {
  OPENAI = 'openai',
  CLAUDE = 'claude',
  BEDROCK = 'bedrock',
  LMSTUDIO = 'lmstudio',
  OTHER = 'other'
}

export interface MCPTool {
  name: string;
  description?: string;
  endpoint?: string;
}

export interface MCPServerMcpConfig {
  command: string;
  args?: string[];
}

export interface MCPServerConfig {
  id: string;
  name: string;
  url?: string;
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  isDefault?: boolean;
  serverType?: MCPServerType;
  tools?: MCPTool[];
  // For command-based MCP servers (like the user's configuration)
  mcpServers?: { [key: string]: MCPServerMcpConfig };
  command?: string;
  args?: string[];
  // Custom headers for HTTP-based MCP servers
  headers?: Record<string, string>;
  // AWS Bedrock specific fields
  awsRegion?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

export interface MCPSettings {
  servers: MCPServerConfig[];
  defaultServerId?: string;
  theme?: 'light' | 'dark' | 'system';
  conversationHistory?: boolean;
  maxConversations?: number;
}

export const DEFAULT_MCP_SETTINGS: MCPSettings = {
  servers: [],
  theme: 'system',
  conversationHistory: true,
  maxConversations: 50
};

// Made with Bob
