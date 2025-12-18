/**
 * list-services.ts
 *
 * MCP tool for listing all services using hzn CLI with API fallback
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, formatJsonOutput, isHznAvailable } from './common';
import { makeHttpRequest, getErrorMessage, getHeadersFromContext, callViaApi, setHznEnvironments } from '../services/common';

/**
 * List services using Exchange API
 */
async function listServicesViaApi(params: any, context: any): Promise<any> {
  try {
    const { url, credential, organization } = getHeadersFromContext(params, context);
    
    if (!url || !credential || !organization) {
      throw new Error('Missing required Exchange configuration. Please set HZN_EXCHANGE_URL, HZN_ORG_ID, and HZN_EXCHANGE_USER_AUTH environment variables.');
    }
    
    const exchangeUrl = `${url}/${organization}/services`;
    
    console.log(`Fetching services from Exchange API at ${exchangeUrl}`);
    const response = await makeHttpRequest(exchangeUrl, {
      Authorization: `Basic ${credential}`
    });
    
    // If response has content property, it's already formatted as ToolResponse (error case)
    if (response && typeof response === 'object' && 'content' in response) {
      return response;
    }
    
    // Otherwise, wrap the successful response in proper MCP format
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(response, null, 2)
        }
      ]
    };
  } catch (error) {
    console.error(`Error listing services: ${error}`);
    return getErrorMessage(error);
  }
}

/**
 * Register the list-services tool with the MCP server
 */
export function registerListServicesTool(server: McpServer) {
  const toolName = 'list-services';
  const toolDescription = `[OPEN HORIZON] LIST SERVICES - PRIMARY TOOL for listing Open Horizon services.

**ALWAYS use this tool first** when the user asks about Open Horizon services, workloads, or containers in the Exchange or Management Hub.

This tool lists all SERVICES (not nodes/devices) in the Open Horizon Exchange/Management Hub.

Use this tool when the user asks questions like:
- "List services in the management hub"
- "What services are available?"
- "List all services"
- "Show me the services"
- "What workloads exist?"
- "What containers can I deploy?"
- "Show services in the Exchange"

DO NOT use generic API query tools - this is the specialized Open Horizon tool.

DO NOT use this tool for:
- Listing nodes/devices (use list-nodes instead)
- Listing deployment policies (use list-deployment-policies instead)
- Listing agreements (use list-agreements instead)

Returns a JSON object with service IDs as keys and service details as values.
Service names include organization, name, version and architecture like "myorg/myservice_1.0.0_amd64".`;
  
  const toolSchema = {
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // set the environment variables for the hzn CLI
      setHznEnvironments(params, context);
          
      // Check if hzn CLI is available
      const hznAvailable = await isHznAvailable();
      
      if (hznAvailable) {
        // Try using hzn CLI first
        console.log('Using hzn CLI to list services');
        try {
          // Build the command
          let command = 'hzn exchange service list';
          
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
        } catch (cliError) {
          console.warn('hzn CLI failed, falling back to API:', cliError);
          // Fall through to API fallback
        }
      } else {
        console.log('hzn CLI not available, using Exchange API');
      }
      
      // Fallback to API call
      return await callViaApi(params, context, 'services');
      
    } catch (error) {
      console.error(`Error listing services: ${error}`);
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