/**
 * cancel-agreement.ts
 * 
 * MCP tool for canceling an agreement using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, getSuccessMessage } from './common';

/**
 * Register the cancel-agreement tool with the MCP server
 */
export function registerCancelAgreementTool(server: McpServer) {
  const toolName = 'cancel-agreement';
  const toolDescription = 'Use this tool to cancel a specific agreement on the local edge node. ' +
    'This executes the hzn agreement cancel command. ' +
    'Canceling an agreement will stop the service, remove the agreement, and allow the agbot to create a new one if conditions are met. ' +
    'Required parameter: agreementId (get from list-agreements tool)';
  
  const toolSchema = {
    agreementId: z.string().describe('Agreement ID to cancel'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.agreementId) {
        return getErrorMessage('agreementId is required');
      }
      
      // Build and execute the command
      const command = `hzn agreement cancel ${params.agreementId}`;
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Agreement canceled successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error canceling agreement: ${error}`);
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