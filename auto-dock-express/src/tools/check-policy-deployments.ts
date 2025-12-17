/**
 * check-policy-deployments.ts
 * 
 * MCP tool for checking which nodes are using a deployment policy using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the check-policy-deployments tool with the MCP server
 */
export function registerCheckPolicyDeploymentsTool(server: McpServer) {
  const toolName = 'check-policy-deployments';
  const toolDescription = 'Use this tool to check which nodes are currently using a specific deployment policy. ' +
    'This executes the hzn exchange deployment status command. ' +
    'Shows active agreements and node deployments based on the policy. ' +
    'Required parameter: policyName';
  
  const toolSchema = {
    policyName: z.string().describe('Name of the deployment policy to check'),
    organization: z.string().optional().describe('Organization name (optional, defaults to current org)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.policyName) {
        return getErrorMessage('policyName is required');
      }
      
      // Build the command
      let command = `hzn exchange deployment status ${params.policyName}`;
      if (params.organization) {
        command += ` -o ${params.organization}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      // Try to parse as JSON
      try {
        const status = JSON.parse(output);
        return {
          content: [
            {
              type: 'text',
              text: formatJsonOutput(status),
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
      console.error(`Error checking policy deployments: ${error}`);
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