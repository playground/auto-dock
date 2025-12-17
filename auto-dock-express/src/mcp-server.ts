import { IncomingHttpHeaders } from 'http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Import all tool registration functions
import { registerAddDeploymentPolicyTool } from './tools/add-deployment-policy';
import { registerAdminStatusTool } from './tools/admin-status';
import { registerCancelAgreementTool } from './tools/cancel-agreement';
import { registerCheckPolicyCompatibilityTool } from './tools/check-policy-compatibility';
import { registerCheckPolicyDeploymentsTool } from './tools/check-policy-deployments';
import { registerGetAgreementDetailsTool } from './tools/get-agreement-details';
import { registerGetNodeStatusTool } from './tools/get-node-status';
import { registerGetServiceDetailsTool } from './tools/get-service-details';
import { registerListAgreementsTool } from './tools/list-agreements';
import { registerListDeploymentPoliciesTool } from './tools/list-deployment-policies';
import { registerListNodesTool } from './tools/list-nodes';
import { registerListServicesTool } from './tools/list-services';
import { registerPublishServiceTool } from './tools/publish-service';
import { registerRegisterNodeTool } from './tools/register-node';
import { registerRemoveDeploymentPolicyTool } from './tools/remove-deployment-policy';
import { registerRemoveServiceTool } from './tools/remove-service';
import { registerUnregisterNodeTool } from './tools/unregister-node';
import { registerUpdateDeploymentPolicyTool } from './tools/update-deployment-policy';

/**
 * Factory to create and configure a new McpServer (tools/resources/prompts)
 *
 * @param initialHeaders - HTTP headers from the initial request (for future use with authentication)
 * @returns Configured McpServer instance
 */
export function createMcpServer(initialHeaders: IncomingHttpHeaders): McpServer {
  console.log('Creating new MCP server instance...');
  
  /**
   * ============================================================================
   * MCP SERVER INSTRUCTIONS FOR AI ASSISTANTS
   * ============================================================================
   *
   * You are an Open Horizon assistant with access to the Open Horizon CLI (hzn)
   * through the following tools.
   *
   * CAPABILITIES:
   *
   * **Node Management:**
   * - get-node-status: Get detailed status of the local edge node
   * - admin-status: Get administrative status of the local agent
   * - list-nodes: List all registered nodes in the Exchange
   * - register-node: Register nodes with patterns or policies
   * - unregister-node: Unregister nodes from the Exchange
   *
   * **Service Management:**
   * - list-services: List all services in the Exchange
   * - get-service-details: Get detailed information about specific services
   * - publish-service: Publish services to the Exchange
   * - remove-service: Remove services from the Exchange
   *
   * **Deployment Policy Management:**
   * - list-deployment-policies: List all deployment policies
   * - add-deployment-policy: Add new deployment policies
   * - update-deployment-policy: Update existing deployment policies
   * - remove-deployment-policy: Remove deployment policies
   * - check-policy-deployments: Check which nodes are deployed with a policy
   * - check-policy-compatibility: Check service compatibility with policies
   *
   * **Agreement Management:**
   * - list-agreements: List all agreements for the local node
   * - get-agreement-details: Get detailed information about specific agreements
   * - cancel-agreement: Cancel agreements
   *
   * IMPORTANT GUIDELINES:
   * - All commands execute on the local Open Horizon agent using the hzn CLI
   * - Service names should NEVER be truncated or simplified
   * - Always use full names including organization, version, and architecture
   * - When listing resources, provide complete information without abbreviation
   * - Always check command output for errors and provide clear feedback
   * - For policy operations, ensure proper JSON formatting and validation
   *
   * ENVIRONMENT:
   * - Commands run with the current user's HZN_ORG_ID and credentials
   * - The local agent must be properly configured and running
   * - Exchange connectivity is required for most operations
   *
   * Always provide clear and concise information about Open Horizon resources.
   * ============================================================================
   */
  
  // Create a new MCP server with proper configuration
  // Note: SDK v1.25.1 uses two-parameter constructor (serverInfo, options)
  const server = new McpServer(
    {
      name: 'auto-dock-mcp-server',
      version: '1.0.0'
    },
    {
      // Declare that this server supports tools, resources, and prompts
      capabilities: {
        tools:     { listChanged: true },
        resources: { listChanged: true },
        prompts:   { listChanged: true }
      }
    }
  );
  
  // Register all available tools
  console.log('Registering Open Horizon tools...');
  
  // Node management tools
  registerGetNodeStatusTool(server);
  registerAdminStatusTool(server);
  registerListNodesTool(server);
  registerRegisterNodeTool(server);
  registerUnregisterNodeTool(server);
  
  // Service management tools
  registerListServicesTool(server);
  registerGetServiceDetailsTool(server);
  registerPublishServiceTool(server);
  registerRemoveServiceTool(server);
  // Note: generate-service-definition tool is incomplete and not registered yet
  
  // Deployment policy tools
  registerListDeploymentPoliciesTool(server);
  registerAddDeploymentPolicyTool(server);
  registerUpdateDeploymentPolicyTool(server);
  registerRemoveDeploymentPolicyTool(server);
  registerCheckPolicyDeploymentsTool(server);
  registerCheckPolicyCompatibilityTool(server);
  
  // Agreement management tools
  registerListAgreementsTool(server);
  registerGetAgreementDetailsTool(server);
  registerCancelAgreementTool(server);
  
  console.log('MCP server instance created successfully with all tools registered');
  return server;
}

// Made with Bob