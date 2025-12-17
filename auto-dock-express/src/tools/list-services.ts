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
  const toolDescription = `Use this tool to list all services in the Open Horizon Exchange.
This tool will attempt to use the 'hzn exchange service list' command if the hzn CLI is available.
If the hzn CLI is not installed, it will fall back to making a direct API call to the Exchange.

Returns a JSON object with service IDs as keys and service details as values.

IMPORTANT: Service names are displayed in full and should never be truncated or simplified.
Service names often include organization, name, version and architecture like "myorg/myservice_1.0.0_amd64".`;
  
  const toolSchema = {
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Check if hzn CLI is available
      const hznAvailable = await isHznAvailable();
      
      if (hznAvailable) {
        // Try using hzn CLI first
        console.log('Using hzn CLI to list services');
        try {
          // Build the command
          let command = 'hzn exchange service list';
          
          // set the environment variables for the hzn CLI
          setHznEnvironments(params, context);
          
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