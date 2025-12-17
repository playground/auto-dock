/**
 * common.ts
 * 
 * Common utilities for MCP tools that execute hzn CLI commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Execute an hzn CLI command and return the result
 * @param command The hzn command to execute
 * @returns The stdout from the command
 */
export async function executeHznCommand(command: string): Promise<string> {
  try {
    console.log(`Executing command: ${command}`);
    const { stdout, stderr } = await execAsync(command);
    
    if (stderr && !stderr.includes('Warning')) {
      console.warn(`Command stderr: ${stderr}`);
    }
    
    return stdout.trim();
  } catch (error: any) {
    console.error(`Command failed: ${error.message}`);
    throw new Error(`Failed to execute command: ${error.message}\n${error.stderr || ''}`);
  }
}

/**
 * Format an error message for MCP tool response
 * @param error The error object or message
 * @returns Formatted error response
 */
export function getErrorMessage(error: any): any {
  const errorMessage = error instanceof Error ? error.message : String(error);
  
  return {
    content: [
      {
        type: 'text',
        text: `Error: ${errorMessage}`
      }
    ],
    isError: true
  };
}

/**
 * Format a success message for MCP tool response
 * @param message The success message or data
 * @returns Formatted success response
 */
export function getSuccessMessage(message: string): any {
  return {
    content: [
      {
        type: 'text',
        text: message
      }
    ]
  };
}

/**
 * Parse JSON output from hzn CLI command
 * @param output The command output
 * @returns Parsed JSON object or original string if not JSON
 */
export function parseJsonOutput(output: string): any {
  try {
    return JSON.parse(output);
  } catch {
    return output;
  }
}

/**
 * Format JSON output for display
 * @param data The data to format
 * @returns Formatted JSON string
 */
export function formatJsonOutput(data: any): string {
  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return data;
    }
  }
  return JSON.stringify(data, null, 2);
}

// Made with Bob