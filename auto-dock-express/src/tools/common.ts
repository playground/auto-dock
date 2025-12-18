/**
 * common.ts
 * 
 * Common utilities for MCP tools that execute hzn CLI commands
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if hzn CLI is available
 */
export async function isHznAvailable(): Promise<boolean> {
  try {
    await executeHznCommand('hzn version');
    return true;
  } catch (error) {
    return false;
  }
}

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