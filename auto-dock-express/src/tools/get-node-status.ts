/**
 * get-node-status.ts
 * 
 * MCP tool for getting detailed status of a specific node using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the get-node-status tool with the MCP server
 */
export function registerGetNodeStatusTool(server: McpServer) {
  const toolName = 'get-node-status';
  const toolDescription = `
    Use this tool to get detailed status and configuration of the local edge node.
    This executes the 'hzn node list' command which returns comprehensive node information including:
    - Node ID and organization
    - Configuration state
    - Connectivity status
    - Exchange version
    - Pattern or policy information
    
    This command queries the local node agent, not the Exchange.
  `;
  const toolSchema = {};
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Execute the command to get local node status
      const command = 'hzn node list';
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
      console.error(`Error getting node status: ${error}`);
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