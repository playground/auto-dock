/**
 * generate-service-definition.ts
 * 
 * MCP tool for generating a service definition file for Open Horizon
 */

import { executeHznCommand, getErrorMessage, getSuccessMessage, formatJsonOutput } from './common.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export const generateServiceDefinitionTool = {
  name: 'generate_service_definition',
  description: `Generate a service definition file for Open Horizon.

This tool generates a service definition JSON file that can be used to publish a service to the Open Horizon Exchange.

You can provide parameters in three ways:
1. Directly as parameters
2. By providing a config file path (.env-config.json)
3. By providing the config as a JSON object

Required parameters (if not using config file or config object):
- serviceName: The name of the service
- serviceVersion: The version of the service
- serviceContainer: The container image for the service

Optional parameters:
- org: Organization ID (default: from environment or "myorg")
- arch: Architecture (default: "amd64")
- volumeMount: Volume mount path (default: "/mms-shared")
- exposePort: Port to expose (default: "3000")
- appPort: Application port (default: "3000")
- mmsObjectType: MMS object type (default: "mms_agent_config")
- updateFileName: Update file name (default: "mms-agent-config.json")
- outputPath: Path to save the generated file (optional, default: current directory)
- saveToFile: Whether to save the generated definition to a file (default: false)

Config file option:
- configPath: Path to a .env-config.json file

Config object option:
- config: JSON object with configuration parameters

Example:
{
  "serviceName": "auto-dock-express",
  "serviceVersion": "1.0.5",
  "serviceContainer": "playbox21/auto-dock-express_arm64:latest",
  "arch": "arm64",
  "saveToFile": true
}`,
  inputSchema: {
    type: 'object',
    properties: {
      serviceName: {
        type: 'string',
        description: 'The name of the service'
      },
      serviceVersion: {
        type: 'string',
        description: 'The version of the service'
      },
      serviceContainer: {
        type: 'string',
        description: 'The container image for the service'
      },
      org: {
        type: 'string',
        description: 'Organization ID. If not provided, uses the default organization.'
      },
      arch: {
        type: 'string',
        description: 'The architecture (default: "amd64")'
      },
      volumeMount: {
        type: 'string',
        description: 'The volume mount path (default: "/mms-shared")'
      },
      exposePort: {
        type: 'string',
        description: 'The port to expose (default: "3000")'
      },
      appPort: {
        type: 'string',
        description: 'The application port (default: "3000")'
      },
      mmsObjectType: {
        type: 'string',
        description: 'The MMS object type (default: "mms_agent_config")'
      },
      updateFileName: {
        type: 'string',
        description: 'The update file name (default: "mms-agent-config.json")'
      },
      outputPath: {
        type: 'string',
        description: 'Path to save the generated file (optional)'
      },
      saveToFile: {
        type: 'boolean',
        description: 'Whether to save the generated definition to a file (default: false)'
      },
      configPath: {
        type: 'string',
        description: 'Path to a .env-config.json file'
      },
      config: {
        type: 'object',
        description: 'JSON object with configuration parameters'
      }
    }
  }
};

/**
 * Handler for the generate_service_definition tool
 */
export async function handleGenerateServiceDefinition(args: any): Promise<any> {
  try {
    let configData: any = {};
    
    // Load configuration from file if provided
    if (args.configPath) {
      try {
        const configContent = await fs.readFile(args.configPath, 'utf8');
        configData = JSON.parse(configContent);
      } catch (error) {
        return getErrorMessage(`Error reading config file: ${error}`);
      }
    } 
    // Use provided config object if available
    else if (args.config) {
      configData = args.config;
    } 
    // Otherwise use individual parameters
    else {
      if (!args.serviceName) {
        return getErrorMessage("Service name is required when not using config file or object");
      }
      
      if (!args.serviceVersion) {
        return getErrorMessage("Service version is required when not using config file or object");
      }
      
      if (!args.serviceContainer) {
        return getErrorMessage("Service container image is required when not using config file or object");
      }
      
      // Map parameters to config data
      configData = {
        ARCH: args.arch || 'amd64',
        HZN_ORG_ID: args.org || process.env.EXCHANGE_ORG || 'myorg',
        SERVICE_NAME: args.serviceName,
        SERVICE_VERSION: args.serviceVersion,
        SERVICE_CONTAINER: args.serviceContainer,
        VOLUME_MOUNT: args.volumeMount || '/mms-shared',
        SHARED_VOLUME: 'mms_shared_volume',
        EXPOSE_PORT: args.exposePort || '3000',
        APP_PORT: args.appPort || '3000',
        MMS_OBJECT_TYPE: args.mmsObjectType || 'mms_agent_config',
        UPDATE_FILE_NAME: args.updateFileName || 'mms-agent-config.json',
        PRIVILEGED: true
      };
    }
    
    // Load the template
    const templatePath = path.join(process.cwd(), 'templates', 'service.definition.json');
    
    console.log(`Loading template from ${templatePath}`);
    let templateContent;
    try {
      templateContent = await fs.readFile(templatePath, 'utf8');
    } catch (error) {
      return getErrorMessage(`Error reading template file: ${error}`);
    }
    
    // Replace variables in the template
    templateContent = templateContent
      .replace(/\$HZN_ORG_ID/g, configData.HZN_ORG_ID)
      .replace(/\$SERVICE_NAME/g, configData.SERVICE_NAME)
      .replace(/\$SERVICE_VERSION/g, configData.SERVICE_VERSION)
      .replace(/\$SERVICE_CONTAINER/g, configData.SERVICE_CONTAINER)
      .replace(/\$ARCH/g, configData.ARCH)
      .replace(/\$VOLUME_MOUNT/g, configData.VOLUME_MOUNT)
      .replace(/\$MMS_SHARED_VOLUME/g, configData.SHARED_VOLUME)
      .replace(/\$EXPOSE_PORT/g, configData.EXPOSE_PORT)
      .replace(/\$APP_PORT/g, configData.APP_PORT)
      .replace(/\$MMS_OBJECT_TYPE/g, configData.MMS_OBJECT_TYPE)
      .replace(/\$UPDATE_FILE_NAME/g, configData.UPDATE_FILE_NAME);
    
    // Parse the template to validate it's valid JSON
    let serviceDefinition;
    try {
      serviceDefinition = JSON.parse(templateContent);
    } catch (error) {
      return getErrorMessage(`Error parsing template: ${error}`);
    }
    
    // Generate the output file name
    const serviceName = configData.SERVICE_NAME;
    const serviceVersion = configData.SERVICE_VERSION;
    const architecture = configData.ARCH;
    const fileName = `${serviceName}_${serviceVersion}_${architecture}.json`;
    const outputDirectory = args.outputPath || '.';
    const outputFilePath = path.join(outputDirectory, fileName);
    
    // Only save to file if explicitly requested
    const saveToFile = args.saveToFile === true;
    let fileMessage = '';
    
    if (saveToFile) {
      try {
        // Ensure output directory exists
        await fs.mkdir(outputDirectory, { recursive: true });
        await fs.writeFile(outputFilePath, JSON.stringify(serviceDefinition, null, 2), 'utf8');
        fileMessage = `Successfully generated service definition file: ${outputFilePath}\n\n`;
      } catch (error) {
        return getErrorMessage(`Error writing service definition file: ${error}`);
      }
    }
    
    return getSuccessMessage(
      `${fileMessage}Service Definition:\n${formatJsonOutput(serviceDefinition)}\n\n` +
      `Service ID: ${configData.HZN_ORG_ID}/${serviceName}_${serviceVersion}_${architecture}\n\n` +
      `Next steps:\n` +
      `1. Review the generated service definition\n` +
      `2. Publish the service: hzn exchange service publish -f ${saveToFile ? outputFilePath : fileName}\n` +
      `3. Verify the service: hzn exchange service list ${configData.HZN_ORG_ID}/${serviceName}_${serviceVersion}_${architecture}`
    );
  } catch (error) {
    console.error(`Error generating service definition: ${error}`);
    return getErrorMessage(error);
  }
}

// Made with Bob