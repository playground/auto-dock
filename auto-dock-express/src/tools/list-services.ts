/**
 * list-services.ts
 * 
 * MCP tool for listing all services using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the list-services tool with the MCP server
 */
export function registerListServicesTool(server: McpServer) {
  const toolName = 'list-services';
  const toolDescription = `Use this tool to list all services in the Open Horizon Exchange.
This executes the 'hzn exchange service list' command.

Returns a JSON object with service IDs as keys and service details as values.

IMPORTANT: Service names are displayed in full and should never be truncated or simplified.
Service names often include organization, name, version and architecture like "myorg/myservice_1.0.0_amd64".`;
  
  const toolSchema = {
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Build the command
      let command = 'hzn exchange service list';
      
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
      console.error(`Error listing services: ${error}`);
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