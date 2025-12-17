import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, throwError, of, timer } from 'rxjs';
import { catchError, map, switchMap, tap, delay } from 'rxjs/operators';
import { MCPServerConfig, MCPServerType, MCPTool } from '../models/mcp-settings.model';
import { MCPSettingsService } from './mcp-settings.service';
import { Message } from './chat.service';

// OpenAI API request format
export interface MCPRequest {
  messages: {
    role: string;
    content: string;
  }[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  // Additional parameters for different API formats
  n?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  // Tool-related parameters
  tools?: any[];
  tool_choice?: string | { type: string; function: { name: string } };
}

export interface MCPToolCall {
  name: string;
  arguments: string;
}

// Claude API request format
export interface ClaudeRequest {
  model: string;
  messages: {
    role: string;
    content: string;
  }[];
  system?: string;
  temperature?: number;
  max_tokens_to_sample?: number;
  stream?: boolean;
  anthropic_version?: string;
}

// OpenAI API response format
export interface MCPResponseChoice {
  index: number;
  message?: {
    role: string;
    content: string;
    tool_calls?: {
      id: string;
      type: string;
      function: {
        name: string;
        arguments: string;
      }
    }[];
  };
  text?: string;
  finish_reason: string;
}

export interface MCPResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: MCPResponseChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Claude API response format
export interface ClaudeContentBlock {
  type: string;
  text: string;
}

export interface ClaudeResponse {
  id: string;
  type: string;
  role: string;
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: string;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

@Injectable({
  providedIn: 'root'
})
export class MCPService {
  constructor(
    private http: HttpClient,
    private mcpSettingsService: MCPSettingsService
  ) {}

  /**
   * Send a message to the MCP server
   * @param messages Array of messages to send
   * @param serverId Optional server ID, uses default if not provided
   */
  sendMessage(messages: Message[], serverId?: string): Observable<Message> {
    console.log('MCPService.sendMessage called with messages:', JSON.stringify(messages, null, 2));
    
    return this.getServer(serverId).pipe(
      switchMap(server => {
        if (!server) {
          return throwError(() => new Error('No MCP server configured'));
        }

        const mcpMessages = messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }));
        
        console.log('Mapped messages for MCP service:', JSON.stringify(mcpMessages, null, 2));

        // Determine server type if not explicitly set
        const serverType = server.serverType || this.determineServerType(server);
        
        // Send message directly to the server
        // LM Studio will handle tool detection and calling using its own MCP configuration
        if (serverType === MCPServerType.CLAUDE) {
          return this.sendClaudeMessage(mcpMessages, server);
        } else {
          return this.sendOpenAICompatibleMessage(mcpMessages, server);
        }
      })
    );
  }
  

  /**
   * Send a message to Claude API
   */
  private sendClaudeMessage(messages: { role: string, content: string }[], server: MCPServerConfig): Observable<Message> {
    // Extract system message if present (usually the first message with role 'system')
    let systemMessage = '';
    const userMessages = messages.filter(msg => {
      if (msg.role === 'system') {
        systemMessage = msg.content;
        return false;
      }
      return true;
    });

    // Prepare Claude request
    const request: ClaudeRequest = {
      model: server.model || 'claude-3-opus-20240229',
      messages: userMessages,
      temperature: server.temperature,
      max_tokens_to_sample: server.maxTokens,
      stream: false,
      anthropic_version: '2023-06-01'
    };

    // Add system message if present
    if (systemMessage) {
      request.system = systemMessage;
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'x-api-key': server.apiKey || '',
      'anthropic-version': '2023-06-01'
    });

    // Claude API endpoint
    const apiEndpoint = `${server.url}/v1/messages`;
    
    console.log('Using Claude API endpoint:', apiEndpoint);
    
    return this.http.post<ClaudeResponse>(
      apiEndpoint,
      request,
      { headers }
    ).pipe(
      map(response => {
        console.log('Received Claude response:', response);
        
        // Extract text content from Claude response
        let content = '';
        if (response.content && response.content.length > 0) {
          // Combine all text blocks
          content = response.content
            .filter(block => block.type === 'text')
            .map(block => block.text)
            .join('\n');
        }
        
        return {
          id: response.id || this.generateId(),
          content: content || 'No content in response',
          role: 'assistant' as const,
          timestamp: new Date()
        };
      }),
      catchError(error => {
        console.error('Error calling Claude API:', error);
        return throwError(() => new Error(`Failed to communicate with Claude API: ${error.message}`));
      })
    );
  }

  /**
   * Send a message to OpenAI-compatible API with a custom request object
   */
  private sendOpenAICompatibleMessageWithRequest(
    messages: { role: string, content: string }[],
    server: MCPServerConfig,
    customRequest?: any
  ): Observable<Message> {
    // Check if this is LLM Studio
    const isLLMStudio = server.serverType === MCPServerType.LMSTUDIO ||
                        (server.url && server.url.includes('localhost')) ||
                        (server.name && server.name.toLowerCase().includes('lmstudio'));
    
    console.log('Is LLM Studio?', isLLMStudio);
    
    // Filter out messages to ensure we have valid user messages
    // Also filter out error messages from assistant
    console.log('Original messages before filtering:', JSON.stringify(messages, null, 2));
    const validMessages = messages.filter(msg => {
      // Keep all user and system messages
      if (msg.role === 'user' || msg.role === 'system') {
        return true;
      }
      
      // For assistant messages, filter out error messages
      if (msg.role === 'assistant') {
        const isErrorMessage =
          msg.content.includes('Failed to parse') ||
          msg.content.includes('Error:') ||
          msg.content.includes('unexpected format') ||
          msg.content.includes('Failed to communicate with') ||
          msg.content.includes('All fallback endpoints failed') ||
          msg.content.includes('All endpoints failed');
        
        return !isErrorMessage;
      }
      
      return false;
    });
    
    // If no valid messages, add a default user message
    // But first check if there was a user message in the original messages
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    console.log('Last user message found:', lastUserMessage ? JSON.stringify(lastUserMessage, null, 2) : 'None');
    
    if (validMessages.length === 0 || !validMessages.some(msg => msg.role === 'user')) {
      const content = lastUserMessage ? lastUserMessage.content : 'Hello';
      console.log('Adding user message with content:', content);
      validMessages.push({
        role: 'user',
        content: content
      });
    }
    
    console.log('Final valid messages after filtering:', JSON.stringify(validMessages, null, 2));
    
    // Use the custom request if provided, otherwise create a standard request
    let request: any;
    if (customRequest) {
      request = customRequest;
      // Make sure to use the valid messages
      request.messages = validMessages;
    } else {
      // Use standard OpenAI format for chat completions
      request = {
        messages: validMessages,
        model: server.model || '', // Let LLM Studio use default model
        temperature: server.temperature || 0.7,
        max_tokens: server.maxTokens || 2000,
        n: 1,
        stream: false
      };
    }
    
    console.log('Final request:', JSON.stringify(request, null, 2));
    
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${server.apiKey}`
    });
    
    // Determine the API endpoint based on the server URL
    let apiEndpoint = '';
    
    // For LMStudio, try different endpoint patterns
    if (server.serverType === MCPServerType.LMSTUDIO || (server.url && server.url.includes('localhost'))) {
      console.log('Using LMStudio-specific endpoint format');
      
      // LLM Studio typically uses /completions endpoint directly
      // First, clean up the URL to ensure we don't have duplicate path segments
      let baseUrl = server.url || '';
      
      // Remove trailing slashes
      baseUrl = baseUrl.replace(/\/+$/, '');
      
      // Remove /v1 if present
      baseUrl = baseUrl.replace(/\/v1$/, '');
      
      // Use the correct LLM Studio endpoints based on documentation
      // LLM Studio supports standard OpenAI-compatible endpoints
      apiEndpoint = `${baseUrl}/v1/chat/completions`;
      
      console.log('Using LLM Studio endpoint:', apiEndpoint);
    } else {
      // Standard OpenAI-compatible API endpoint
      if (server.url && !server.url.includes('/v1')) {
        apiEndpoint = `${server.url}/v1/chat/completions`;
      } else {
        apiEndpoint = `${server.url}/chat/completions`;
      }
    }
    
    console.log('Using API endpoint:', apiEndpoint);
    console.log('With request format:', JSON.stringify(request, null, 2));
    
    return this.http.post<MCPResponse>(
      apiEndpoint,
      request,
      { headers }
    ).pipe(
      map(response => {
        console.log('Received response:', response);
        
        // Handle different response formats
        if (response.choices && response.choices.length > 0) {
          const choice = response.choices[0];
          
          // Handle OpenAI format
          if (choice.message) {
            // Check for tool calls in the response
            if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
              const toolCall = choice.message.tool_calls[0];
              
              // Format tool call response
              return {
                id: response.id || this.generateId(),
                content: `Tool call: ${toolCall.function.name}\nArguments: ${toolCall.function.arguments}`,
                role: 'assistant' as const,
                timestamp: new Date()
              };
            }
            
            // Regular message response
            return {
              id: response.id || this.generateId(),
              content: choice.message.content,
              role: 'assistant' as const,
              timestamp: new Date()
            };
          }
          // Handle LMStudio format which might return text directly
          else if (choice.text) {
            return {
              id: response.id || this.generateId(),
              content: choice.text,
              role: 'assistant' as const,
              timestamp: new Date()
            };
          }
        }
        
        // Fallback if response format is unexpected
        return {
          id: response.id || this.generateId(),
          content: 'Received response in unexpected format. Please check server configuration.',
          role: 'assistant' as const,
          timestamp: new Date()
        };
      }),
      catchError(error => {
        console.error('Error calling MCP server:', error);
        
        // Try alternative endpoints if 404 error with LMStudio
        if (error.status === 404 && (server.serverType === MCPServerType.LMSTUDIO || (server.url && server.url.includes('localhost')))) {
          console.log('Trying alternative LMStudio endpoints...');
          
          // Clean base URL
          let cleanBaseUrl = server.url ? server.url.replace(/\/+$/, '') : '';
          
          // Clean base URL more aggressively
          cleanBaseUrl = cleanBaseUrl.replace(/\/v1$/, '');
          
          // Try only the endpoints that are supported by LLM Studio according to the documentation
          // Each endpoint requires a different request format
          // Reorder to prioritize endpoints that are more likely to work for chat
          const fallbackEndpoints = [
            {
              url: `${cleanBaseUrl}/v1/completions`,
              formatRequest: (msgs: any[]) => {
                // Get the last user message
                const lastUserMsg = msgs.filter(m => m.role === 'user').pop()?.content || 'Hello';
                console.log(`Completions endpoint: Using user message: "${lastUserMsg}"`);
                return {
                  prompt: lastUserMsg,
                  model: server.model || '',
                  temperature: server.temperature || 0.7,
                  max_tokens: server.maxTokens || 2000,
                  n: 1,
                  stream: false
                };
              }
            },
            {
              url: `${cleanBaseUrl}/v1/chat/completions`,
              formatRequest: (msgs: any[]) => {
                // Make sure we have at least one user message
                if (!msgs.some(m => m.role === 'user')) {
                  // Add a default user message if none exists
                  msgs.push({
                    role: 'user',
                    content: 'Hello'
                  });
                }
                
                console.log(`Chat completions endpoint with messages:`, JSON.stringify(msgs, null, 2));
                return {
                  messages: msgs,
                  model: server.model || '',
                  temperature: server.temperature || 0.7,
                  max_tokens: server.maxTokens || 2000,
                  n: 1,
                  stream: false
                };
              }
            },
            {
              url: `${cleanBaseUrl}/v1/responses`,
              formatRequest: (msgs: any[]) => {
                // Get the last user message
                const lastUserMsg = msgs.filter(m => m.role === 'user').pop()?.content || 'Hello';
                console.log(`Responses endpoint: Using user message: "${lastUserMsg}"`);
                return {
                  input: lastUserMsg, // Changed from 'inputs' to 'input' based on error message
                  model: server.model || 'default', // Add required model parameter
                  parameters: {
                    max_new_tokens: server.maxTokens || 2000,
                    temperature: server.temperature || 0.7,
                    do_sample: true
                  }
                };
              }
            },
            {
              url: `${cleanBaseUrl}/v1/embeddings`,
              formatRequest: (msgs: any[]) => {
                // Get the last user message
                const lastUserMsg = msgs.filter(m => m.role === 'user').pop()?.content || 'Hello';
                console.log(`Embeddings endpoint: Using user message: "${lastUserMsg}"`);
                return {
                  input: lastUserMsg,
                  model: server.model || 'text-embedding-nomic-embed-text-v1.5'
                };
              }
            }
          ];
          
          console.log('Will try these fallback endpoints:', fallbackEndpoints);
          
          // Try the first fallback endpoint
          const tryNextEndpoint = (index = 0): Observable<Message> => {
            if (index >= fallbackEndpoints.length) {
              return throwError(() => new Error('All fallback endpoints failed'));
            }
            
            const endpoint = fallbackEndpoints[index];
            console.log(`Attempting fallback #${index + 1}:`, endpoint.url);
            
            // IMPORTANT: Make sure we're passing the user's actual message
            // Get the original messages before filtering
            console.log('Fallback: Original messages before filtering:', JSON.stringify(messages, null, 2));
            
            // Extract the last user message first to ensure we don't lose it
            const originalUserMessage = messages.filter(msg => msg.role === 'user').pop();
            console.log('Fallback: Original user message:', originalUserMessage ? JSON.stringify(originalUserMessage, null, 2) : 'None');
            
            // Now filter messages
            const validMessages = messages.filter(msg => {
              // Keep all user and system messages
              if (msg.role === 'user' || msg.role === 'system') {
                return true;
              }
              
              // For assistant messages, filter out error messages
              if (msg.role === 'assistant') {
                const isErrorMessage =
                  msg.content.includes('Failed to parse') ||
                  msg.content.includes('Error:') ||
                  msg.content.includes('unexpected format') ||
                  msg.content.includes('Failed to communicate with') ||
                  msg.content.includes('All fallback endpoints failed') ||
                  msg.content.includes('All endpoints failed');
                
                return !isErrorMessage;
              }
              
              return false;
            });
            
            // If we have the original user message but it's not in the valid messages,
            // make sure to add it back
            if (originalUserMessage && !validMessages.some(msg =>
                msg.role === 'user' && msg.content === originalUserMessage.content)) {
              console.log('Fallback: Re-adding original user message:', originalUserMessage.content);
              validMessages.push(originalUserMessage);
            }
            // If still no valid user messages, add a default
            else if (!validMessages.some(msg => msg.role === 'user')) {
              console.log('Fallback: No user messages found, adding default');
              validMessages.push({
                role: 'user',
                content: 'Hello'
              });
            }
            
            console.log('Fallback: Final valid messages after filtering:', JSON.stringify(validMessages, null, 2));
            
            // Format the request based on the endpoint
            console.log(`Formatting request for endpoint ${endpoint.url} with valid messages:`, JSON.stringify(validMessages, null, 2));
            const textRequest = endpoint.formatRequest(validMessages);
            
            console.log(`Fallback #${index + 1} request:`, JSON.stringify(textRequest, null, 2));
            
            console.log(`Fallback #${index + 1} request to ${endpoint.url}:`, JSON.stringify(textRequest, null, 2));
            
            return this.http.post<any>(
              endpoint.url,
              textRequest,
              { headers }
            ).pipe(
              map(response => {
                console.log(`Fallback #${index + 1} succeeded with response:`, JSON.stringify(response, null, 2));
                
                // Handle different response formats based on the endpoint
                if (endpoint.url.includes('/embeddings')) {
                  // For embeddings endpoint, return a message with the embedding info
                  return {
                    id: this.generateId(),
                    content: `Embeddings generated successfully. Dimensions: ${response.data?.[0]?.embedding?.length || 'unknown'}`,
                    role: 'assistant' as const,
                    timestamp: new Date()
                  };
                } else if (endpoint.url.includes('/completions')) {
                  // For completions endpoint
                  if (response.choices && response.choices.length > 0) {
                    const choice = response.choices[0];
                    
                    // Extract text from the response
                    let content = '';
                    if (choice.message && choice.message.content) {
                      // Chat completions format
                      content = choice.message.content;
                    } else if (choice.text) {
                      // Completions format
                      content = choice.text;
                    } else {
                      // Try to extract text from other properties
                      content = choice.content || response.text || response.output || '';
                    }
                    
                    if (content) {
                      return {
                        id: response.id || this.generateId(),
                        content: content,
                        role: 'assistant' as const,
                        timestamp: new Date()
                      };
                    }
                  }
                } else if (response.generated_text) {
                  // For responses endpoint
                  return {
                    id: this.generateId(),
                    content: response.generated_text,
                    role: 'assistant' as const,
                    timestamp: new Date()
                  };
                }
                
                // If we can't parse the response, try to extract any text we can find
                let content = '';
                
                // Try to find any text in the response
                if (typeof response === 'string') {
                  content = response;
                } else if (typeof response === 'object') {
                  // Look for common text fields in the response
                  const possibleTextFields = ['text', 'content', 'message', 'output', 'result', 'response', 'answer'];
                  
                  for (const field of possibleTextFields) {
                    if (response[field]) {
                      if (typeof response[field] === 'string') {
                        content = response[field];
                        break;
                      } else if (typeof response[field] === 'object' && response[field].content) {
                        content = response[field].content;
                        break;
                      }
                    }
                  }
                  
                  // If we still don't have content, stringify the response
                  if (!content) {
                    content = `Response: ${JSON.stringify(response)}`;
                  }
                }
                
                if (!content) {
                  content = 'Failed to parse response from server.';
                }
                
                return {
                  id: this.generateId(),
                  content: content,
                  role: 'assistant' as const,
                  timestamp: new Date()
                };
              }),
              catchError(fallbackError => {
                console.error(`Fallback #${index + 1} failed with status ${fallbackError.status}:`, fallbackError);
                console.error(`Error details for ${endpoint.url}:`, fallbackError.error || fallbackError.message);
                
                // Add a small delay before trying the next endpoint to avoid overwhelming the server
                const delayMs = 300;
                console.log(`Waiting ${delayMs}ms before trying next endpoint...`);
                
                // Use timer to create a delay before trying the next endpoint
                return timer(delayMs).pipe(
                  switchMap(() => tryNextEndpoint(index + 1))
                );
              })
            );
          };
          
          return tryNextEndpoint();
          
          // The recursive tryNextEndpoint function replaces this code
        }
        
        return throwError(() => new Error(`Failed to communicate with MCP server at ${apiEndpoint}: ${error.message || 'Unknown error'}`));
      })
    );
  }

  /**
   * Send a message to OpenAI-compatible API (including LMStudio)
   */
  private sendOpenAICompatibleMessage(messages: { role: string, content: string }[], server: MCPServerConfig): Observable<Message> {
    // Send the message directly to the server
    // LM Studio will handle tool detection and calling using its own MCP configuration
    return this.sendOpenAICompatibleMessageWithRequest(messages, server);
  }

  /**
   * Determine the server type based on the URL and name if not explicitly set
   */
  private determineServerType(server: MCPServerConfig): MCPServerType {
    if (server.serverType) {
      return server.serverType;
    }
    
    // Check URL for clues
    if (server.url && server.url.includes('anthropic') || server.name.toLowerCase().includes('claude')) {
      return MCPServerType.CLAUDE;
    } else if (server.url && server.url.includes('openai') || server.name.toLowerCase().includes('openai')) {
      return MCPServerType.OPENAI;
    } else if (server.url && server.url.includes('localhost') || server.name.toLowerCase().includes('lmstudio')) {
      return MCPServerType.LMSTUDIO;
    }
    
    // Default to OpenAI-compatible
    return MCPServerType.OTHER;
  }

  /**
   * Get a server configuration
   * @param serverId Optional server ID, uses default if not provided
   */
  private getServer(serverId?: string): Observable<MCPServerConfig | undefined> {
    if (serverId) {
      const settings = this.mcpSettingsService.getSettings();
      const server = settings.servers.find(s => s.id === serverId);
      return server ? of(server) : of(undefined);
    } else {
      return of(this.mcpSettingsService.getDefaultServer());
    }
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// Made with Bob
