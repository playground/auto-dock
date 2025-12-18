/**
 * list-nodes.ts
 * 
 * MCP tool for listing all registered nodes using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, formatJsonOutput, isHznAvailable } from './common';
import { callViaApi, getErrorMessage, setHznEnvironments } from '../services/common';

/**
 * Register the list-nodes tool with the MCP server
 */
export function registerListNodesTool(server: McpServer) {
  const toolName = 'list-nodes';
  const toolDescription = `[OPEN HORIZON] LIST NODES - PRIMARY TOOL for listing Open Horizon nodes/devices.

**ALWAYS use this tool first** when the user asks about Open Horizon nodes, devices, or edge devices.

This tool lists all registered NODES/DEVICES (not services) in the Open Horizon Exchange/Management Hub.

Use this tool when the user asks questions like:
- "List nodes in the management hub"
- "What nodes are registered?"
- "List all nodes"
- "Show me the devices"
- "What edge devices exist?"
- "Which nodes are available?"

DO NOT use generic API query tools - this is the specialized Open Horizon tool.

DO NOT use this tool for:
- Listing services/workloads (use list-services instead)
- Listing deployment policies (use list-deployment-policies instead)
- Getting node status (use get-node-status instead)

Returns a JSON object with node IDs as keys and node details as values.
Node names include identifiers like "edge-device-001" or "witty-anoa".`;
  const toolSchema = {
    org: z.string().optional().describe('Organization ID. If not provided, uses the default organization from HZN_ORG_ID environment variable.'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Check if hzn CLI is available
      const hznAvailable = await isHznAvailable();
      
      if (hznAvailable) {
        // Try using hzn CLI first
        console.log('Using hzn CLI to list nodes');
        try {
        // Build the command
        let command = 'hzn exchange node list';
        
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
      return await callViaApi(params, context, 'nodes');
    } catch (error) {
      console.error(`Error listing nodes: ${error}`);
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