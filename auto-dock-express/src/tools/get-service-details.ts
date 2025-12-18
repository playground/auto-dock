/**
 * get-service-details.ts
 * 
 * MCP tool for getting detailed information about a specific service using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, formatJsonOutput } from './common';
import { getErrorMessage } from '../services/common';

/**
 * Register the get-service-details tool with the MCP server
 */
export function registerGetServiceDetailsTool(server: McpServer) {
  const toolName = 'get-service-details';
  const toolDescription = `Use this tool to get detailed information about a specific service in the Open Horizon Exchange.
This executes the 'hzn exchange service list <service-id>' command.

Returns comprehensive service information including:
- Service URL, version, and architecture
- Deployment configuration
- Service dependencies
- User inputs
- Deployment signature

The service ID should be in the format: org/servicename_version_arch
Example: myorg/myservice_1.0.0_amd64`;
  
  const toolSchema = {
    serviceId: z.string().describe('Service ID in format: org/servicename_version_arch'),
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.serviceId) {
        return getErrorMessage('serviceId is required');
      }
      
      // Build the command
      let command = `hzn exchange service list ${params.serviceId}`;
      
      // Add organization flag if provided
      if (params.org) {
        command += ` -o ${params.org}`;
      }
      
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
    } catch (error) {
      console.error(`Error getting service details: ${error}`);
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