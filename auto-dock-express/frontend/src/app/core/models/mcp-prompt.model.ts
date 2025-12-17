/**
 * MCP Prompt Models
 * Type definitions for MCP prompts
 */

export interface MCPPrompt {
  name: string;
  description?: string;
  arguments?: MCPPromptArgument[];
  server: string; // Which MCP server provides this prompt
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

export interface PromptExecutionRequest {
  server: string;
  promptName: string;
  arguments: Record<string, string>;
}

// Made with Bob
