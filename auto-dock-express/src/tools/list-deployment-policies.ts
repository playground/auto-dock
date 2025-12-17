/**
 * list-deployment-policies.ts
 * 
 * MCP tool for listing deployment policies using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the list-deployment-policies tool with the MCP server
 */
export function registerListDeploymentPoliciesTool(server: McpServer) {
  const toolName = 'list-deployment-policies';
  const toolDescription = 'Use this tool to list all deployment policies in the Open Horizon Exchange. ' +
    'This executes the hzn exchange deployment listpolicy command. ' +
    'Deployment policies define which services should be deployed to which nodes based on constraints and properties. ' +
    'Optional parameter: organization (defaults to current org)';
  
  const toolSchema = {
    organization: z.string().optional().describe('Organization name (optional, defaults to current org)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Build the command
      let command = 'hzn exchange deployment listpolicy';
      if (params.organization) {
        command += ` -o ${params.organization}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      // Try to parse as JSON
      try {
        const policies = JSON.parse(output);
        return {
          content: [
            {
              type: 'text',
              text: formatJsonOutput(policies),
            },
          ],
        };
      } catch {
        // If not JSON, return as plain text
        return {
          content: [
            {
              type: 'text',
              text: output,
            },
          ],
        };
      }
    } catch (error) {
      console.error(`Error listing deployment policies: ${error}`);
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