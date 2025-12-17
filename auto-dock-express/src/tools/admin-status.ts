/**
 * admin-status.ts
 * 
 * MCP tool for getting admin status using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, formatJsonOutput } from './common';

/**
 * Register the admin-status tool with the MCP server
 */
export function registerAdminStatusTool(server: McpServer) {
  const toolName = 'admin-status';
  const toolDescription = 'Use this tool to get the administrative status of the local Open Horizon agent. ' +
    'This executes the hzn node management status command. ' +
    'Shows agent health, configuration status, and any administrative issues. ' +
    'No parameters required.';
  
  const toolSchema = {};
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Execute the command
      const output = await executeHznCommand('hzn node management status');
      
      // Try to parse as JSON
      try {
        const status = JSON.parse(output);
        return {
          content: [
            {
              type: 'text',
              text: formatJsonOutput(status),
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
      console.error(`Error getting admin status: ${error}`);
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