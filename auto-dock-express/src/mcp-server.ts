import { IncomingHttpHeaders } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Factory to create and configure a new McpServer (tools/resources/prompts)
 *
 * @param initialHeaders - HTTP headers from the initial request (for future use with authentication)
 * @returns Configured McpServer instance
 */
export function createMcpServer(initialHeaders: IncomingHttpHeaders): McpServer {
  console.log('Creating new MCP server instance...');
  
  // Create a new MCP server with proper configuration
  const server = new McpServer(
    {
      name: 'auto-dock-mcp-server',
      version: '1.0.0'
    },
    {
      // Declare that this server supports tools, resources, and prompts
      capabilities: {
        tools:     {},
        resources: {},
        prompts:   {}
      }
    }
  );
  
  // TODO: Register tools here when ready
  // Example:
  // registerDeviceTools(server);
  // registerInterfaceTools(server);
  // registerPolicyTools(server);
  
  console.log('MCP server instance created successfully');
  return server;
}