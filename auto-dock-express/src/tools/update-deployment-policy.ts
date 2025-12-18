/**
 * update-deployment-policy.ts
 * 
 * MCP tool for updating a deployment policy using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand } from './common';
import { getErrorMessage, getSuccessMessage } from '../services/common';

/**
 * Register the update-deployment-policy tool with the MCP server
 */
export function registerUpdateDeploymentPolicyTool(server: McpServer) {
  const toolName = 'update-deployment-policy';
  const toolDescription = 'Use this tool to update an existing deployment policy in the Open Horizon Exchange. ' +
    'This executes the hzn exchange deployment updatepolicy command. ' +
    'Updates the policy definition with new constraints, properties, or service references. ' +
    'Required parameters: policyName, jsonFile (path to updated policy JSON file)';
  
  const toolSchema = {
    policyName: z.string().describe('Name of the deployment policy to update'),
    jsonFile: z.string().describe('Path to the JSON file containing the updated policy definition'),
    organization: z.string().optional().describe('Organization name (optional, defaults to current org)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.policyName || !params.jsonFile) {
        return getErrorMessage('policyName and jsonFile are required');
      }
      
      // Build the command
      let command = `hzn exchange deployment updatepolicy ${params.policyName} -f ${params.jsonFile}`;
      if (params.organization) {
        command += ` -o ${params.organization}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Deployment policy updated successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error updating deployment policy: ${error}`);
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