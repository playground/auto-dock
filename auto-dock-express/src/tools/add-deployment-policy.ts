/**
 * add-deployment-policy.ts
 * 
 * MCP tool for adding a deployment policy using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand } from './common';
import { getErrorMessage, getSuccessMessage } from '../services/common';

/**
 * Register the add-deployment-policy tool with the MCP server
 */
export function registerAddDeploymentPolicyTool(server: McpServer) {
  const toolName = 'add-deployment-policy';
  const toolDescription = 'Use this tool to add a new deployment policy to the Open Horizon Exchange. ' +
    'This executes the hzn exchange deployment addpolicy command. ' +
    'A deployment policy defines which services should be deployed to which nodes based on constraints and properties. ' +
    'Required parameters: policyName, jsonFile (path to policy JSON file)';
  
  const toolSchema = {
    policyName: z.string().describe('Name for the deployment policy'),
    jsonFile: z.string().describe('Path to the JSON file containing the policy definition'),
    organization: z.string().optional().describe('Organization name (optional, defaults to current org)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.policyName || !params.jsonFile) {
        return getErrorMessage('policyName and jsonFile are required');
      }
      
      // Build the command
      let command = `hzn exchange deployment addpolicy ${params.policyName} -f ${params.jsonFile}`;
      if (params.organization) {
        command += ` -o ${params.organization}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Deployment policy added successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error adding deployment policy: ${error}`);
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