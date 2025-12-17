/**
 * Type definitions for MCP Orchestrator Backend Agent
 * Supports multiple AI providers (Claude, OpenAI, etc.)
 */

// ============================================================================
// AI Provider Types
// ============================================================================

export type AIProvider = 'claude' | 'openai' | 'bedrock' | 'custom' | 'bob' | 'ollama';

export interface AIProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
  maxTokens?: number;
  temperature?: number;
  baseURL?: string; // For custom providers
  region?: string; // For AWS Bedrock
  accessKeyId?: string; // For AWS Bedrock
  secretAccessKey?: string; // For AWS Bedrock
}

// ============================================================================
// MCP Server Configuration
// ============================================================================

export type MCPTransportType = 'http' | 'stdio';

export interface MCPServerConfig {
  name: string;
  transport: MCPTransportType;
  description?: string;
  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

// MCP Tool Definition
export interface MCPTool {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// MCP Prompt Definition
export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
}

export interface MCPPromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface MCPPromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  };
}

export interface MCPPromptResult {
  description?: string;
  messages: MCPPromptMessage[];
}

// ============================================================================
// User Query & Response
// ============================================================================

// User Query Request
export interface QueryRequest {
  message: string;
  conversationId?: string;
  context?: ConversationContext[];
  provider?: AIProvider; // Allow per-request provider override
}

// Conversation Context
export interface ConversationContext {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: string;
}

// Agent Response
export interface AgentResponse {
  message: string;
  toolsUsed?: ToolExecution[];
  conversationId: string;
  timestamp: string;
  provider: AIProvider;
  model: string;
}

// Tool Execution Result
export interface ToolExecution {
  toolName: string;
  server: string;
  input: any;
  output: any;
  success: boolean;
  error?: string;
  executionTime: number;
}

// ============================================================================
// Unified AI Message Format (Provider-agnostic)
// ============================================================================

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AIContent[];
}

export interface AIContent {
  type: 'text' | 'tool_use' | 'tool_result' | 'function_call' | 'function_result';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  content?: string | any[];
}

// ============================================================================
// Unified Tool Definition (Provider-agnostic)
// ============================================================================

export interface AITool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// ============================================================================
// Provider-Specific Types
// ============================================================================

// Claude API Types
export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContent[];
}

export interface ClaudeContent {
  type: 'text' | 'tool_use' | 'tool_result';
  text?: string;
  id?: string;
  name?: string;
  input?: any;
  tool_use_id?: string;
  content?: string | any[];
}

export interface ClaudeTool {
  name: string;
  description: string;
  input_schema: {
    type: string;
    properties: Record<string, any>;
    required?: string[];
  };
}

// OpenAI API Types
export interface OpenAIMessage {
  role: 'user' | 'assistant' | 'system' | 'function' | 'tool';
  content: string | null;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
  tool_calls?: OpenAIToolCall[];
  tool_call_id?: string;
}

export interface OpenAIToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface OpenAITool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: string;
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

// ============================================================================
// AI Service Interface (Strategy Pattern)
// ============================================================================

export interface IAIService {
  provider: AIProvider;
  
  /**
   * Send a message and get a response
   */
  chat(
    messages: AIMessage[],
    tools?: AITool[],
    options?: ChatOptions
  ): Promise<AIServiceResponse>;
  
  /**
   * Execute a tool call
   */
  executeToolCall(
    toolName: string,
    toolInput: any,
    mcpServers: MCPServerConfig[]
  ): Promise<ToolExecution>;
}

export interface ChatOptions {
  temperature?: number;
  maxTokens?: number;
  stream?: boolean;
}

export interface AIServiceResponse {
  message: string;
  toolCalls?: {
    id: string;
    name: string;
    input: any;
  }[];
  finishReason: 'stop' | 'tool_use' | 'max_tokens' | 'error';
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

// ============================================================================
// MCP Client Response
// ============================================================================

export interface MCPClientResponse {
  success: boolean;
  data?: any;
  error?: string;
}

// ============================================================================
// Server Health & Status
// ============================================================================

export interface ServerHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  aiProvider: {
    provider: AIProvider;
    model: string;
    available: boolean;
  };
  mcpServers: {
    name: string;
    transport: string;
    url?: string;
    command?: string;
    connected: boolean;
    toolCount: number;
  }[];
  uptime: number;
  timestamp: string;
}

// Error Response
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

// Made with Bob
