/**
 * get-agreement-details.ts
 * 
 * MCP tool for getting details of a specific agreement using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the get-agreement-details tool with the MCP server
 */
export function registerGetAgreementDetailsTool(server: McpServer) {
  const toolName = 'get-agreement-details';
  const toolDescription = 'Use this tool to get detailed information about a specific agreement. ' +
    'This executes the hzn agreement list command with a specific agreement ID. ' +
    'Shows agreement terms, service details, workload status, and policy information. ' +
    'Required parameter: agreementId (get from list-agreements tool)';
  
  const toolSchema = {
    agreementId: z.string().describe('Agreement ID to get details for'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.agreementId) {
        return getErrorMessage('agreementId is required');
      }
      
      // Execute the command to get all agreements, then filter
      const output = await executeHznCommand('hzn agreement list');
      
      // Parse the output
      try {
        const agreements = JSON.parse(output);
        
        // Find the specific agreement
        const agreement = agreements.find((a: any) => 
          a.current_agreement_id === params.agreementId || 
          a.agreement_id === params.agreementId
        );
        
        if (!agreement) {
          return getErrorMessage(`Agreement not found: ${params.agreementId}`);
        }
        
        return {
          content: [
            {
              type: 'text',
              text: formatJsonOutput(agreement),
            },
          ],
        };
      } catch {
        // If parsing fails, return raw output
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
      console.error(`Error getting agreement details: ${error}`);
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