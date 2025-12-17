doimport { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { MCPService, MCPRequest, MCPResponse, ClaudeRequest, ClaudeResponse } from './mcp.service';
import { MCPSettingsService } from './mcp-settings.service';
import { MCPServerConfig, MCPServerType } from '../models/mcp-settings.model';

describe('MCPService', () => {
  let service: MCPService;
  let httpMock: HttpTestingController;
  let settingsServiceMock: jasmine.SpyObj<MCPSettingsService>;

  // Sample server configurations for testing
  const openAIServer: MCPServerConfig = {
    id: 'openai-server',
    name: 'OpenAI Server',
    url: 'https://api.openai.com/v1',
    apiKey: 'test-api-key',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2048
  };

  const lmStudioServer: MCPServerConfig = {
    id: 'lmstudio-server',
    name: 'LMStudio Server',
    url: 'http://localhost:1234/v1',
    apiKey: '',
    model: 'llama2',
    temperature: 0.7,
    maxTokens: 2048,
    serverType: MCPServerType.LMSTUDIO
  };

  const claudeServer: MCPServerConfig = {
    id: 'claude-server',
    name: 'Claude API',
    url: 'https://api.anthropic.com',
    apiKey: 'test-claude-api-key',
    model: 'claude-3-opus-20240229',
    temperature: 0.7,
    maxTokens: 2048,
    serverType: MCPServerType.CLAUDE
  };

  const lmStudioServerNoV1: MCPServerConfig = {
    id: 'lmstudio-server-no-v1',
    name: 'LMStudio Server (No V1)',
    url: 'http://localhost:1234',
    apiKey: '',
    model: 'llama2',
    temperature: 0.7,
    maxTokens: 2048
  };

  // Sample messages for testing
  const testMessages = [
    { id: '1', content: 'Hello', role: 'user' as const, timestamp: new Date() },
    { id: '2', content: 'Hi there!', role: 'assistant' as const, timestamp: new Date() },
    { id: '3', content: 'How are you?', role: 'user' as const, timestamp: new Date() }
  ];

  beforeEach(() => {
    // Create a mock for MCPSettingsService
    const settingsSpy = jasmine.createSpyObj('MCPSettingsService', ['getSettings', 'getDefaultServer']);

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        MCPService,
        { provide: MCPSettingsService, useValue: settingsSpy }
      ]
    });

    service = TestBed.inject(MCPService);
    httpMock = TestBed.inject(HttpTestingController);
    settingsServiceMock = TestBed.inject(MCPSettingsService) as jasmine.SpyObj<MCPSettingsService>;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('sendMessage', () => {
    it('should send a message to an OpenAI-compatible server', () => {
      // Setup mock response
      const mockResponse: MCPResponse = {
        id: 'response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I am an AI assistant.'
            },
            finish_reason: 'stop'
          }
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30
        }
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(openAIServer);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('I am an AI assistant.');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${openAIServer.url}/chat/completions`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('Authorization')).toBe(`Bearer ${openAIServer.apiKey}`);
      
      // Check request body
      const requestBody = req.request.body as MCPRequest;
      expect(requestBody.messages.length).toBe(testMessages.length);
      expect(requestBody.model).toBe(openAIServer.model);
      expect(requestBody.temperature).toBe(openAIServer.temperature);
      expect(requestBody.max_tokens).toBe(openAIServer.maxTokens);
      
      // Respond with mock data
      req.flush(mockResponse);
    });

    it('should send a message to LMStudio server with /v1 in URL', () => {
      // Setup mock response
      const mockResponse: MCPResponse = {
        id: 'response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I am a locally running AI model.'
            },
            finish_reason: 'stop'
          }
        ]
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(lmStudioServer);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('I am a locally running AI model.');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${lmStudioServer.url}/chat/completions`);
      expect(req.request.method).toBe('POST');
      
      // Check request body
      const requestBody = req.request.body as MCPRequest;
      expect(requestBody.messages.length).toBe(testMessages.length);
      expect(requestBody.model).toBe(lmStudioServer.model);
      expect(requestBody.n).toBe(1); // LMStudio specific parameter
      expect(requestBody.stream).toBe(false); // LMStudio specific parameter
      
      // Respond with mock data
      req.flush(mockResponse);
    });

    it('should send a message to LMStudio server without /v1 in URL', () => {
      // Setup mock response
      const mockResponse: MCPResponse = {
        id: 'response-id',
        object: 'chat.completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'I am a locally running AI model.'
            },
            finish_reason: 'stop'
          }
        ]
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(lmStudioServerNoV1);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('I am a locally running AI model.');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${lmStudioServerNoV1.url}/v1/chat/completions`);
      expect(req.request.method).toBe('POST');
      
      // Respond with mock data
      req.flush(mockResponse);
    });

    it('should handle text completion response format', () => {
      // Setup mock response with text property instead of message
      const mockResponse: MCPResponse = {
        id: 'response-id',
        object: 'text_completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            text: 'This is a text completion response.',
            finish_reason: 'stop'
          }
        ]
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(lmStudioServer);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('This is a text completion response.');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${lmStudioServer.url}/chat/completions`);
      expect(req.request.method).toBe('POST');
      
      // Respond with mock data
      req.flush(mockResponse);
    });

    it('should try fallback endpoint when receiving 404 error from LMStudio', () => {
      // Setup mock responses
      const mockErrorResponse = { status: 404, statusText: 'Not Found' };
      const mockFallbackResponse = {
        id: 'fallback-response-id',
        object: 'text_completion',
        created: Date.now(),
        model: 'llama2',
        choices: [
          {
            index: 0,
            text: 'This is a fallback response.',
            finish_reason: 'stop'
          }
        ]
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(lmStudioServer);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('This is a fallback response.');
        expect(response.role).toBe('assistant');
      });

      // Verify the first HTTP request and respond with error
      const req1 = httpMock.expectOne(`${lmStudioServer.url}/chat/completions`);
      expect(req1.request.method).toBe('POST');
      req1.flush('Not Found', mockErrorResponse);

      // Verify the fallback HTTP request
      const fallbackEndpoint = lmStudioServer.url ?
        lmStudioServer.url.replace(/\/v1\/chat$/, '').replace(/\/v1$/, '') + '/completions' :
        'http://localhost:1234/completions';
      const req2 = httpMock.expectOne(fallbackEndpoint);
      expect(req2.request.method).toBe('POST');
      
      // Check fallback request body format (should be text completion format)
      const requestBody = req2.request.body;
      expect(requestBody.prompt).toBeDefined();
      expect(requestBody.model).toBe(lmStudioServer.model);
      
      // Respond with mock fallback data
      req2.flush(mockFallbackResponse);
    });

    it('should throw an error when no server is configured', (done) => {
      // Configure the mock settings service to return undefined
      settingsServiceMock.getDefaultServer.and.returnValue(undefined);

      // Call the service method
      service.sendMessage(testMessages).subscribe({
        next: () => {
          fail('Expected an error, but got a response');
        },
        error: (error) => {
          expect(error.message).toBe('No MCP server configured');
          done();
        }
      });
    });

    it('should send a message to Claude API server', () => {
      // Setup mock response
      const mockResponse: ClaudeResponse = {
        id: 'msg_01ABCDEFGhiJKLMNopqRSTUv',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'I am Claude, an AI assistant.'
          }
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20
        }
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(claudeServer);

      // Call the service method
      service.sendMessage(testMessages).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('I am Claude, an AI assistant.');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${claudeServer.url}/v1/messages`);
      expect(req.request.method).toBe('POST');
      expect(req.request.headers.get('x-api-key')).toBe(claudeServer.apiKey || '');
      expect(req.request.headers.get('anthropic-version')).toBe('2023-06-01');
      
      // Check request body
      const requestBody = req.request.body as ClaudeRequest;
      expect(requestBody.messages.length).toBe(testMessages.length);
      expect(requestBody.model).toBe(claudeServer.model || 'claude-3-opus-20240229');
      expect(requestBody.temperature).toBe(claudeServer.temperature);
      expect(requestBody.max_tokens_to_sample).toBe(claudeServer.maxTokens);
      
      // Respond with mock data
      req.flush(mockResponse);
    });

    it('should handle system messages correctly in Claude API requests', () => {
      // Setup messages with a system message
      const messagesWithSystem = [
        { id: '1', content: 'You are a helpful assistant.', role: 'system' as const, timestamp: new Date() },
        { id: '2', content: 'Hello', role: 'user' as const, timestamp: new Date() }
      ];

      // Setup mock response
      const mockResponse: ClaudeResponse = {
        id: 'msg_01ABCDEFGhiJKLMNopqRSTUv',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! How can I assist you today?'
          }
        ],
        model: 'claude-3-opus-20240229',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 15,
          output_tokens: 25
        }
      };

      // Configure the mock settings service
      settingsServiceMock.getDefaultServer.and.returnValue(claudeServer);

      // Call the service method
      service.sendMessage(messagesWithSystem).subscribe(response => {
        expect(response).toBeTruthy();
        expect(response.content).toBe('Hello! How can I assist you today?');
        expect(response.role).toBe('assistant');
      });

      // Verify the HTTP request
      const req = httpMock.expectOne(`${claudeServer.url}/v1/messages`);
      expect(req.request.method).toBe('POST');
      
      // Check request body - system message should be in system field, not in messages
      const requestBody = req.request.body as ClaudeRequest;
      expect(requestBody.messages.length).toBe(1); // Only the user message
      expect(requestBody.system).toBe('You are a helpful assistant.');
      
      // Respond with mock data
      req.flush(mockResponse);
    });
  });
});

// Made with Bob
