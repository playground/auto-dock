/**
 * remove-deployment-policy.ts
 * 
 * MCP tool for removing a deployment policy using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand } from './common';
import { getErrorMessage, getSuccessMessage } from '../services/common';

/**
 * Register the remove-deployment-policy tool with the MCP server
 */
export function registerRemoveDeploymentPolicyTool(server: McpServer) {
  const toolName = 'remove-deployment-policy';
  const toolDescription = 'Use this tool to remove a deployment policy from the Open Horizon Exchange. ' +
    'This executes the hzn exchange deployment removepolicy command. ' +
    'Removing a policy will prevent new deployments based on that policy, but existing agreements will continue until canceled. ' +
    'Required parameter: policyName';
  
  const toolSchema = {
    policyName: z.string().describe('Name of the deployment policy to remove'),
    organization: z.string().optional().describe('Organization name (optional, defaults to current org)'),
    force: z.boolean().optional().describe('Force removal without confirmation (optional)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.policyName) {
        return getErrorMessage('policyName is required');
      }
      
      // Build the command
      let command = `hzn exchange deployment removepolicy ${params.policyName}`;
      if (params.organization) {
        command += ` -o ${params.organization}`;
      }
      if (params.force) {
        command += ' -f';
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Deployment policy removed successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error removing deployment policy: ${error}`);
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