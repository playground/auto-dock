/**
 * register-node.ts
 * 
 * MCP tool for registering a node with a pattern or policy using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, getSuccessMessage } from './common';

/**
 * Register the register-node tool with the MCP server
 */
export function registerRegisterNodeTool(server: McpServer) {
  const toolName = 'register-node';
  const toolDescription = `
    Use this tool to register an edge node with Open Horizon using a pattern or policy.
    This executes the 'hzn register' command.
    
    You can register with either:
    1. A pattern (pattern parameter)
    2. A policy (policy parameter)
    
    Required parameters:
    - Either pattern OR policy must be provided
    - nodeToken: Authentication token for the node
    
    Optional parameters:
    - org: Organization ID (uses HZN_ORG_ID if not provided)
    - nodeId: Node ID (uses hostname if not provided)
    - waitService: Wait for specified service to start
    - waitOrg: Organization of the service to wait for
    - waitTimeout: Timeout in seconds for waiting (default: 60)
  `;
  const toolSchema = {
    pattern: z.string().optional().describe('Pattern name to register with (e.g., "IBM/pattern-ibm.helloworld")'),
    policy: z.string().optional().describe('Policy file path to register with'),
    nodeToken: z.string().describe('Node authentication token'),
    org: z.string().optional().describe('Organization ID'),
    nodeId: z.string().optional().describe('Node ID (uses hostname if not provided)'),
    waitService: z.string().optional().describe('Service to wait for before completing registration'),
    waitOrg: z.string().optional().describe('Organization of the service to wait for'),
    waitTimeout: z.number().optional().describe('Timeout in seconds for waiting (default: 60)'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      // Validate that either pattern or policy is provided
      if (!params.pattern && !params.policy) {
        return getErrorMessage('Either pattern or policy must be provided');
      }
      
      if (params.pattern && params.policy) {
        return getErrorMessage('Cannot specify both pattern and policy');
      }
      
      if (!params.nodeToken) {
        return getErrorMessage('nodeToken is required');
      }
      
      // Build the command
      let command = 'hzn register';
      
      // Add organization flag
      if (params.org) {
        command += ` -o ${params.org}`;
      }
      
      // Add node ID flag
      if (params.nodeId) {
        command += ` -n ${params.nodeId}`;
      }
      
      // Add pattern or policy
      if (params.pattern) {
        command += ` -p ${params.pattern}`;
      } else if (params.policy) {
        command += ` --policy ${params.policy}`;
      }
      
      // Add node token
      command += ` -t ${params.nodeToken}`;
      
      // Add wait parameters if provided
      if (params.waitService) {
        command += ` -s ${params.waitService}`;
        
        if (params.waitOrg) {
          command += ` --serviceorg ${params.waitOrg}`;
        }
        
        if (params.waitTimeout) {
          command += ` -t ${params.waitTimeout}`;
        }
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Node registered successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error registering node: ${error}`);
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