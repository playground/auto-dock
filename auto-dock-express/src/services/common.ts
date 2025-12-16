import { ToolResponse } from "../models/model";
import 'dotenv/config';

let headersPassthrough: any = {};

export function getHeadersFromContext(context: any): Record<string, string> {
  // Access headers from the shared context
  const headers = context.requestInfo?.headers || {};
  const sevoneApiKey = process.env.SEVONE_API_KEY;
  headersPassthrough.Authorization = headers['sevone-api-key'] || sevoneApiKey || '';
  
  // Allow dynamic configuration of RAG API URL via headers
  if(headers['sevone-rag-api-url']) {
    process.env.SEVONE_RAG_API_URL = headers['sevone-rag-api-url'];
  }
  if(headers['openai-api-key']) {
    process.env.OPENAI_API_KEY = headers['openai-api-key'];
  }
  
  return headersPassthrough;
}

export function getAuthorizationHeader(params: any, context: any): string {
  // Access headers from the shared context
  getHeadersFromContext(context);
  return headersPassthrough.Authorization || '';
}

/**
 * Formats error messages into the expected ToolResponse format
 * @param err Error object or message
 * @returns Formatted ToolResponse with error message
 */
export function getErrorMessage(err: any): ToolResponse {
  console.log('Show error message:', err);
  if (err instanceof Error) {
    console.error("[ERROR]", err.message);
    return {
      content: [
        {
          type: "text",
          text: `Error fetching data: ${err.message}`,
        },
      ],
    };
  }

  console.error("[UNKNOWN ERROR]", err);
  return {
    content: [
      {
        type: "text",
        text: typeof err === 'string' ? err : "An unknown error occurred.",
      },
    ],
  };
}

/**
 * Makes an HTTP request to the specified URL with optional headers
 * @param url URL to make the request to
 * @param headers Optional headers to include in the request
 * @returns Promise resolving to the response data or an error ToolResponse
 */
export async function makeHttpRequest<T = any>(url: string, headers: Record<string, string> = {}): Promise<T | ToolResponse> {
  const finalHeaders = {
    "Accept": "application/json",
    ...headers
  };

  try {
    const response = await fetch(url, { headers: finalHeaders });

    if (!response.ok) {
      return getErrorMessage(`Error fetching data: ${response.status} ${response.statusText}`);
    }
    
    // Check content type to handle HTML responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      console.error('Received HTML response instead of JSON:', text.substring(0, 200) + '...');
      return {
        content: [{
          type: "text",
          text: "Error: The API returned an HTML page instead of JSON data. This might indicate an authentication issue or that the endpoint is not available. Please check your API credentials and try again."
        }]
      };
    }
    
    try {
      return (await response.json()) as T;
    } catch (error) {
      // If JSON parsing fails, try to get the text content
      const text = await response.text();
      console.error('Failed to parse JSON response:', text.substring(0, 200) + '...');
      return getErrorMessage(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }

  } catch (err: any) {
    console.log(`Error making request to ${url}:`, err);
    return getErrorMessage(`Error fetching data: ${err.message || "Unknown error"}`);
  }
}

/**
 * Makes an HTTP POST request with JSON data
 * @param url URL to make the request to
 * @param data Data to send in the request body
 * @param headers Optional headers to include in the request
 * @returns Promise resolving to the response data or an error ToolResponse
 */
export async function makePostRequest<T = any>(url: string, data: any, headers: Record<string, string> = {}, method = 'POST'): Promise<T | ToolResponse> {
  const finalHeaders = {
    "Accept": "application/json",
    "Content-Type": "application/json",
    ...headers
  };

  try {
    const response = await fetch(url, {
      method: method,
      headers: finalHeaders,
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      return getErrorMessage(`Error posting data: ${response.status} ${response.statusText}`);
    }
    
    // Check content type to handle HTML responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      console.error('Received HTML response instead of JSON:', text.substring(0, 200) + '...');
      return {
        content: [{
          type: "text",
          text: "Error: The API returned an HTML page instead of JSON data. This might indicate an authentication issue or that the endpoint is not available. Please check your API credentials and try again."
        }]
      };
    }
    
    try {
      return (await response.json()) as T;
    } catch (error) {
      // If JSON parsing fails, try to get the text content
      const text = await response.text();
      console.error('Failed to parse JSON response:', text.substring(0, 200) + '...');
      return getErrorMessage(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }

  } catch (err: any) {
    console.log(`Error making POST request to ${url}:`, err);
    return getErrorMessage(`Error posting data: ${err.message || "Unknown error"}`);
  }
}

/**
 * Makes an HTTP DELETE request
 * @param url URL to make the request to
 * @param headers Optional headers to include in the request
 * @returns Promise resolving to the response data or an error ToolResponse
 */
export async function makeDeleteRequest<T = any>(url: string, headers: Record<string, string> = {}): Promise<T | ToolResponse> {
  const finalHeaders = {
    "Accept": "application/json",
    ...headers
  };

  try {
    const response = await fetch(url, {
      method: 'DELETE',
      headers: finalHeaders
    });

    if (!response.ok) {
      return getErrorMessage(`Error deleting resource: ${response.status} ${response.statusText}`);
    }
    
    // Some DELETE operations might not return content
    if (response.status === 204) {
      return { success: true } as unknown as T;
    }
    
    // Check content type to handle HTML responses
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      const text = await response.text();
      console.error('Received HTML response instead of JSON:', text.substring(0, 200) + '...');
      return {
        content: [{
          type: "text",
          text: "Error: The API returned an HTML page instead of JSON data. This might indicate an authentication issue or that the endpoint is not available. Please check your API credentials and try again."
        }]
      };
    }
    
    try {
      return (await response.json()) as T;
    } catch (error) {
      // If JSON parsing fails, try to get the text content
      const text = await response.text();
      console.error('Failed to parse JSON response:', text.substring(0, 200) + '...');
      return getErrorMessage(`Failed to parse JSON response: ${error instanceof Error ? error.message : 'Unknown parsing error'}`);
    }

  } catch (err: any) {
    console.log(`Error making DELETE request to ${url}:`, err);
    return getErrorMessage(`Error deleting resource: ${err.message || "Unknown error"}`);
  }
}

// Made with Bob