/**
 * MCP Configuration Models
 * Following Claude Desktop configuration standard
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
 * Parsed MCP server configuration for backend communication
 * Extracts URL and headers from the args
 */
export interface ParsedMcpServer {
  name: string;
  url: string;
  headers: Record<string, string>;
  env: Record<string, string>;
}

export interface McpServerInfo {
  name: string;
  enabled: boolean;
  config: McpServerConfig;
  tools?: McpTool[];
  connected?: boolean;
  error?: string;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: any;
}

export interface McpServerStatus {
  name: string;
  connected: boolean;
  toolCount: number;
  tools: McpTool[];
  error?: string;
}

// Default configuration template
export const DEFAULT_MCP_CONFIG: McpConfiguration = {
  mcpServers: {}
};

// Example configuration for reference
export const EXAMPLE_MCP_CONFIG: McpConfiguration = {
  mcpServers: {
    "mesh-swagger": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mesh-swagger-dev.1zcqw752hw76.us-south.codeengine.appdomain.cloud/mcp",
        "--header",
        "mesh-api-key:YOUR_API_KEY",
        "--header",
        "mesh-rag-api-url:https://hcm-graphrag-dev.1zcqw752hw76.us-south.codeengine.appdomain.cloud/api/query",
        "--header",
        "openai-api-key:YOUR_OPENAI_KEY",
        "--header",
        "ieam-rag-api-url:https://ieam-graphrag-dev.1zcqw752hw76.us-south.codeengine.appdomain.cloud/api/query",
        "--header",
        "Authorization:Bearer YOUR_TOKEN"
      ],
      "env": {}
    },
    "sevone-mcp-server": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3002/mcp",
        "--header",
        "mesh-api-key:YOUR_API_KEY",
        "--header",
        "sevone-rag-api-url:http://localhost:3007/api/query",
        "--header",
        "openai-api-key:YOUR_OPENAI_KEY",
        "--header",
        "Authorization:Bearer YOUR_TOKEN"
      ],
      "env": {}
    },
    "open-horizon-mcp": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:3000/mcp",
        "--header",
        "exchange-org:ieam-dev-jefflu",
        "--header",
        "exchange-url:https://ibm-edge.ieam-poc-574c25a9e145dd8c8db5b5c614b682cb-0000.us-south.containers.appdomain.cloud/edge-exchange/v1/orgs",
        "--header",
        "exchange-credential:YOUR_CREDENTIAL",
        "--header",
        "Authorization:${AUTH_TOKEN}"
      ],
      "env": {
        "AUTH_TOKEN": "Bearer YOUR_TOKEN"
      }
    }
  }
};

/**
 * Parse MCP server configuration to extract URL and headers
 * This parses the Claude Desktop format where:
 * - args[2] is the URL
 * - args with --header flag contain header key:value pairs
 * - env variables can be referenced in headers using ${VAR_NAME}
 */
export function parseMcpServerConfig(name: string, config: McpServerConfig): ParsedMcpServer {
  const headers: Record<string, string> = {};
  let url = '';
  
  // Find the URL (typically the first arg after 'mcp-remote')
  const mcpRemoteIndex = config.args.findIndex(arg => arg === 'mcp-remote');
  if (mcpRemoteIndex >= 0 && mcpRemoteIndex + 1 < config.args.length) {
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
    url,
    headers,
    env: config.env || {}
  };
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
