/**
 * remove-service.ts
 * 
 * MCP tool for removing a service from the Exchange using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, getSuccessMessage } from './common';

/**
 * Register the remove-service tool with the MCP server
 */
export function registerRemoveServiceTool(server: McpServer) {
  const toolName = 'remove-service';
  const toolDescription = `Use this tool to remove a service from the Open Horizon Exchange.
This executes the 'hzn exchange service remove' command.

WARNING: This is a destructive operation. The service will be permanently deleted.
Make sure no nodes are currently using this service before removing it.

Required parameters:
- serviceId: Service ID in format: org/servicename_version_arch

Optional parameters:
- org: Organization ID
- force: Force removal even if service is referenced by patterns or policies`;
  
  const toolSchema = {
    serviceId: z.string().describe('Service ID in format: org/servicename_version_arch'),
    org: z.string().optional().describe('Organization ID'),
    force: z.boolean().optional().describe('Force removal even if referenced'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.serviceId) {
        return getErrorMessage('serviceId is required');
      }
      
      // Build the command
      let command = `hzn exchange service remove ${params.serviceId}`;
      
      // Add organization flag
      if (params.org) {
        command += ` -o ${params.org}`;
      }
      
      // Add force flag
      if (params.force) {
        command += ' -f';
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Service removed successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error removing service: ${error}`);
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