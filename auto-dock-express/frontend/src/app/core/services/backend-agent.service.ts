/**
 * Backend Agent Service
 * Communicates with MCP Orchestrator backend for AI queries using session-based auth
 */

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { McpConfiguration } from '../models/mcp-config.model';
import { MCPPrompt, MCPPromptResult, PromptExecutionRequest } from '../models/mcp-prompt.model';

export interface CredentialsRequest {
  provider: 'claude' | 'openai' | 'bedrock' | 'custom';
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

export interface SessionStatus {
  authenticated: boolean;
  provider?: string;
}

export interface QueryRequest {
  message: string;
  conversationId?: string;
  context?: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface QueryResponse {
  message: string;
  toolsUsed?: Array<{
    toolName: string;
    server: string;
    input: any;
    output: any;
    success: boolean;
    error?: string;
    executionTime: number;
  }>;
  conversationId: string;
  timestamp: string;
  provider: string;
  model: string;
}

@Injectable({
  providedIn: 'root'
})
export class BackendAgentService {
  private readonly apiUrl = environment.getBackendUrl ? environment.getBackendUrl() : (environment.backendUrl || 'http://localhost:3100/api');

  constructor(private http: HttpClient) {}

  /**
   * Submit user credentials to backend session
   */
  submitCredentials(credentials: CredentialsRequest): Observable<{ message: string; provider: string }> {
    return this.http.post<{ message: string; provider: string }>(
      `${this.apiUrl}/auth/credentials`,
      credentials,
      { withCredentials: true } // Important: send session cookie
    );
  }

  /**
   * Check if user has active session with credentials
   */
  checkSessionStatus(): Observable<SessionStatus> {
    return this.http.get<SessionStatus>(
      `${this.apiUrl}/auth/status`,
      { withCredentials: true }
    );
  }

  /**
   * Clear credentials from session (keep session alive)
   */
  clearCredentials(): Observable<{ message: string }> {
    return this.http.delete<{ message: string }>(
      `${this.apiUrl}/auth/credentials`,
      { withCredentials: true }
    );
  }

  /**
   * Submit MCP server configuration to backend session
   */
  submitMcpConfiguration(config: McpConfiguration): Observable<{ message: string; serverCount: number }> {
    return this.http.post<{ message: string; serverCount: number }>(
      `${this.apiUrl}/auth/mcp-config`,
      config,
      { withCredentials: true }
    );
  }

  /**
   * Get MCP server status from backend
   */
  getMcpServerStatus(): Observable<{ servers: any[] }> {
    return this.http.get<{ servers: any[] }>(
      `${this.apiUrl}/agent/mcp-status`,
      { withCredentials: true }
    );
  }

  /**
   * Logout and destroy entire session
   */
  logout(): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(
      `${this.apiUrl}/auth/logout`,
      {},
      { withCredentials: true }
    );
  }

  /**
   * Send a query to the AI agent
   */
  query(request: QueryRequest): Observable<QueryResponse> {
    return this.http.post<QueryResponse>(
      `${this.apiUrl}/agent/query`,
      request,
      { withCredentials: true }
    );
  }

  /**
   * Convenience method to send a simple message
   */
  sendMessage(message: string, conversationId?: string): Observable<QueryResponse> {
    return this.query({ message, conversationId });
  }

  /**
   * Get all available prompts from MCP servers
   */
  getPrompts(): Observable<{ prompts: MCPPrompt[] }> {
    return this.http.get<{ prompts: MCPPrompt[] }>(
      `${this.apiUrl}/agent/prompts`,
      { withCredentials: true }
    );
  }

  /**
   * Get a filled prompt template
   */
  getPromptTemplate(request: PromptExecutionRequest): Observable<MCPPromptResult> {
    return this.http.post<MCPPromptResult>(
      `${this.apiUrl}/agent/prompts/${request.server}/${request.promptName}`,
      { arguments: request.arguments },
      { withCredentials: true }
    );
  }
}

// Made with Bob