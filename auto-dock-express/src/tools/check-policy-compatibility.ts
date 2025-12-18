/**
 * check-policy-compatibility.ts
 * 
 * MCP tool for checking policy compatibility using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, formatJsonOutput } from './common';
import { getErrorMessage } from '../services/common';

/**
 * Register the check-policy-compatibility tool with the MCP server
 */
export function registerCheckPolicyCompatibilityTool(server: McpServer) {
  const toolName = 'check-policy-compatibility';
  const toolDescription = 'Use this tool to check if a node policy is compatible with a deployment policy. ' +
    'This executes the hzn policy check command. ' +
    'Verifies that constraints and properties match between node and deployment policies. ' +
    'Required parameters: nodePolicyFile, deploymentPolicyFile';
  
  const toolSchema = {
    nodePolicyFile: z.string().describe('Path to the node policy JSON file'),
    deploymentPolicyFile: z.string().describe('Path to the deployment policy JSON file'),
    serviceId: z.string().optional().describe('Service ID to check compatibility for (optional)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.nodePolicyFile || !params.deploymentPolicyFile) {
        return getErrorMessage('nodePolicyFile and deploymentPolicyFile are required');
      }
      
      // Build the command
      let command = `hzn policy check -n ${params.nodePolicyFile} -b ${params.deploymentPolicyFile}`;
      if (params.serviceId) {
        command += ` -s ${params.serviceId}`;
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      // Try to parse as JSON
      try {
        const result = JSON.parse(output);
        return {
          content: [
            {
              type: 'text',
              text: formatJsonOutput(result),
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
      console.error(`Error checking policy compatibility: ${error}`);
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