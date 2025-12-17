/**
 * unregister-node.ts
 * 
 * MCP tool for unregistering a node using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, getSuccessMessage } from './common';

/**
 * Register the unregister-node tool with the MCP server
 */
export function registerUnregisterNodeTool(server: McpServer) {
  const toolName = 'unregister-node';
  const toolDescription = `Use this tool to unregister an edge node from Open Horizon.
This executes the 'hzn unregister' command.

This will:
- Stop all services running on the node
- Remove all agreements
- Unregister the node from the Exchange

Use with caution as this is a destructive operation.

Optional parameters:
- force: Force unregistration even if there are active agreements (default: false)
- removeNode: Also remove the node resource from the Exchange (default: false)
- deep: Deep clean - remove all containers and images (default: false)
- timeout: Timeout in seconds (default: 60)`;
  const toolSchema = {
    force: z.boolean().optional().describe('Force unregistration even if there are active agreements'),
    removeNode: z.boolean().optional().describe('Also remove the node resource from the Exchange'),
    deep: z.boolean().optional().describe('Deep clean - remove all containers and images'),
    timeout: z.number().optional().describe('Timeout in seconds (default: 60)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Build the command
      let command = 'hzn unregister';
      
      // Add force flag
      if (params.force) {
        command += ' -f';
      }
      
      // Add remove node flag
      if (params.removeNode) {
        command += ' -r';
      }
      
      // Add deep clean flag
      if (params.deep) {
        command += ' -D';
      }
      
      // Add timeout
      if (params.timeout) {
        command += ` -t ${params.timeout}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Node unregistered successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error unregistering node: ${error}`);
      return getErrorMessage(error);
    }
  };
  
  server.registerTool(
    toolName,
    {
      description: toolDescription,
      inputSchema: toolSchema
    },
    toolCallback
  );
}

// Made with Bob