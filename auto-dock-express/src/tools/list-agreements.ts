/**
 * list-agreements.ts
 * 
 * MCP tool for listing all agreements using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the list-agreements tool with the MCP server
 */
export function registerListAgreementsTool(server: McpServer) {
  const toolName = 'list-agreements';
  const toolDescription = `Use this tool to list all active agreements on the local edge node.
This executes the 'hzn agreement list' command.

Returns a JSON array of agreements with details including:
- Agreement ID
- Service details (org, URL, version, arch)
- Agreement protocol
- Current state
- Workload usage information

Agreements represent the contract between the node and the agbot for running services.`;
  
  const toolSchema = {};
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Execute the command
      const command = 'hzn agreement list';
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
      console.error(`Error listing agreements: ${error}`);
      return getErrorMessage(error);
    }
  };
  
  server.tool(
    toolName,
    toolDescription,
    toolSchema,
    toolCallback
  );
}

// Made with Bob