/**
 * publish-service.ts
 * 
 * MCP tool for publishing a service to the Exchange using hzn CLI
 */

import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeHznCommand, getErrorMessage, getSuccessMessage } from './common';

/**
 * Register the publish-service tool with the MCP server
 */
export function registerPublishServiceTool(server: McpServer) {
  const toolName = 'publish-service';
  const toolDescription = `Use this tool to publish a service to the Open Horizon Exchange.
This executes the 'hzn exchange service publish' command.

You must provide a service definition file in JSON format.
The file should contain all service metadata including deployment configuration.

Required parameters:
- serviceDefinitionFile: Path to the service definition JSON file

Optional parameters:
- privateKeyFile: Path to private key file for signing the service
- publicKeyFile: Path to public key file to store with the service
- org: Organization ID
- overwrite: Overwrite existing service if it exists (default: false)
- pullImage: Pull the Docker image to validate it exists (default: false)`;
  
  const toolSchema = {
    serviceDefinitionFile: z.string().describe('Path to the service definition JSON file'),
    privateKeyFile: z.string().optional().describe('Path to private key file for signing'),
    publicKeyFile: z.string().optional().describe('Path to public key file'),
    org: z.string().optional().describe('Organization ID'),
    overwrite: z.boolean().optional().describe('Overwrite existing service'),
    pullImage: z.boolean().optional().describe('Pull Docker image to validate'),
  };
  
  const toolCallback = async (params: any, context: any): Promise<any> => {
    try {
      if (!params.serviceDefinitionFile) {
        return getErrorMessage('serviceDefinitionFile is required');
      }
      
      // Build the command
      let command = `hzn exchange service publish -f ${params.serviceDefinitionFile}`;
      
      // Add organization flag
      if (params.org) {
        command += ` -o ${params.org}`;
      }
      
      // Add private key for signing
      if (params.privateKeyFile) {
        command += ` -k ${params.privateKeyFile}`;
      }
      
      // Add public key
      if (params.publicKeyFile) {
        command += ` -K ${params.publicKeyFile}`;
      }
      
      // Add overwrite flag
      if (params.overwrite) {
        command += ' --overwrite';
      }
      
      // Add pull image flag
      if (params.pullImage) {
        command += ' --pull-image';
      }
      
      // Execute the command
      const output = await executeHznCommand(command);
      
      return getSuccessMessage(`Service published successfully.\n\n${output}`);
    } catch (error) {
      console.error(`Error publishing service: ${error}`);
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