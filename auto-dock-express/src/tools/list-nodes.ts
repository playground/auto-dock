/**
 * list-nodes.ts
 * 
 * MCP tool for listing all registered nodes using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the list-nodes tool with the MCP server
 */
export function registerListNodesTool(server: McpServer) {
  const toolName = 'list-nodes';
  const toolDescription = `
    Use this tool to list all registered nodes in the Open Horizon Exchange.
    This executes the 'hzn exchange node list' command.
    
    Returns a JSON object with node IDs as keys and node details as values.
    
    IMPORTANT: Node names are displayed in full and should never be truncated or simplified.
    Node names often include complex identifiers like "edge-device-001" or "witty-anoa".
  `;
  const toolSchema = {
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Build the command
      let command = 'hzn exchange node list';
      
      // Add organization flag if provided
      if (params.org) {
        command += ` -o ${params.org}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      // Format and return the output
      return {
        content: [
          {
            type: 'text',
            text: formatJsonOutput(output)
          }
        ]
      };
    } catch (error) {
      console.error(`Error listing nodes: ${error}`);
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