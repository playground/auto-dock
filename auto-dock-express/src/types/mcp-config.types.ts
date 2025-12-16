/**
 * MCP Configuration Types for Backend
 * Matches the Claude Desktop configuration format
 */

export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

export interface McpConfiguration {
  mcpServers: Record<string, McpServerConfig>;
}

/**
 * Transport type for MCP servers
 */
export type MCPTransportType = 'http' | 'stdio';

/**
 * Parsed MCP server for backend use
 * Supports both HTTP/SSE and stdio transports
 */
export interface ParsedMcpServer {
  name: string;
  transport: MCPTransportType;
  // For HTTP/SSE transport
  url?: string;
  headers?: Record<string, string>;
  // For stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
}

/**
 * Parse MCP server configuration to detect transport type and extract relevant info
 */
export function parseMcpServerConfig(name: string, config: McpServerConfig): ParsedMcpServer {
  // Check if this is an HTTP/SSE server (uses mcp-remote)
  const mcpRemoteIndex = config.args.findIndex(arg => arg === 'mcp-remote');
  
  if (mcpRemoteIndex >= 0) {
    // HTTP/SSE transport
    const headers: Record<string, string> = {};
    let url = '';
    
    // Find the URL (typically the first arg after 'mcp-remote')
    if (mcpRemoteIndex + 1 < config.args.length) {
      url = config.args[mcpRemoteIndex + 1];
    }
    
    // Parse headers from args
    for (let i = 0; i < config.args.length; i++) {
      if (config.args[i] === '--header' && i + 1 < config.args.length) {
        const headerValue = config.args[i + 1];
        const colonIndex = headerValue.indexOf(':');
        if (colonIndex > 0) {
          const key = headerValue.substring(0, colonIndex);
          let value = headerValue.substring(colonIndex + 1);
          
          // Replace environment variable references
          if (config.env) {
            value = value.replace(/\$\{(\w+)\}/g, (match, varName) => {
              return config.env![varName] || match;
            });
          }
          
          headers[key] = value;
        }
      }
    }
    
    return {
      name,
      transport: 'http',
      url,
      headers: Object.keys(headers).length > 0 ? headers : undefined
    };
  } else {
    // Stdio transport
    return {
      name,
      transport: 'stdio',
      command: config.command,
      args: config.args,
      env: config.env
    };
  }
}

/**
 * Parse all MCP servers from configuration
 */
export function parseAllMcpServers(config: McpConfiguration): ParsedMcpServer[] {
  return Object.entries(config.mcpServers).map(([name, serverConfig]) =>
    parseMcpServerConfig(name, serverConfig)
  );
}

// Made with Bob
