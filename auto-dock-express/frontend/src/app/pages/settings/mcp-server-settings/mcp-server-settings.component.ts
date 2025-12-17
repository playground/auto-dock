import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { MCPServerConfig, MCPSettings, MCPServerType } from '../../../core/models/mcp-settings.model';
import { MCPSettingsService } from '../../../core/services/mcp-settings.service';
import { BackendAgentService, CredentialsRequest, SessionStatus } from '../../../core/services/backend-agent.service';
import { McpDiscoveryService } from '../../../core/services/mcp-discovery.service';

@Component({
  selector: 'app-mcp-server-settings',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './mcp-server-settings.component.html',
  styleUrls: ['./mcp-server-settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MCPServerSettingsComponent implements OnInit, OnDestroy {
  serverForm: FormGroup;
  servers: MCPServerConfig[] = [];
  editingServerId: string | null = null;
  isAddingServer = false;
  serverTypes = MCPServerType;
  
  // UI state for show/hide MCP server configuration
  showMcpServerConfig = false;
  
  // Backend agent credentials
  credentialsForm!: FormGroup;
  sessionStatus: SessionStatus | null = null;
  showApiKey = false;
  showAwsSecret = false;
  submittingCredentials = false;
  
  // Model options based on provider
  availableModels: { value: string; label: string; description?: string }[] = [];
  
  // Saved credentials for multiple providers
  savedProviderCredentials: Map<string, CredentialsRequest> = new Map();
  
  private subscriptions: Subscription[] = [];
  
  // Model definitions
  private modelsByProvider: {
    [key: string]: Array<{ value: string; label: string; description?: string }>;
  } = {
    bob: [
      { value: 'claude-3-7-sonnet-20250219', label: 'Claude 3.7 Sonnet', description: 'Latest & most capable (200K tokens)' },
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Excellent for complex tasks' },
      { value: 'gpt-4o', label: 'GPT-4o', description: 'OpenAI\'s latest multimodal model' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo', description: 'Fast and capable' },
      { value: 'o1-preview', label: 'O1 Preview', description: 'Advanced reasoning model' }
    ],
    claude: [
      { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', description: 'Most capable, best for complex tasks' },
      { value: 'claude-3-opus-20240229', label: 'Claude 3 Opus', description: 'Previous flagship model' },
      { value: 'claude-3-sonnet-20240229', label: 'Claude 3 Sonnet', description: 'Balanced performance' },
      { value: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', description: 'Fastest, most affordable' }
    ],
    openai: [
      { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo', description: 'Most capable, 128K context' },
      { value: 'gpt-4', label: 'GPT-4', description: 'High intelligence, 8K context' },
      { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo', description: 'Fast and affordable' }
    ],
    bedrock: [
      { value: 'us.anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet', description: 'Most capable (~80% cheaper!)' },
      { value: 'us.anthropic.claude-3-opus-20240229-v1:0', label: 'Claude 3 Opus', description: 'Previous flagship' },
      { value: 'us.anthropic.claude-3-sonnet-20240229-v1:0', label: 'Claude 3 Sonnet', description: 'Balanced' },
      { value: 'us.anthropic.claude-3-haiku-20240307-v1:0', label: 'Claude 3 Haiku', description: 'Fastest, cheapest' }
    ],
    ollama: [],
    custom: []
  };
  
  // State for Ollama models
  loadingOllamaModels = false;
  ollamaModelsError: string | null = null;
  
  constructor(
    private fb: FormBuilder,
    private mcpSettingsService: MCPSettingsService,
    private backendAgent: BackendAgentService,
    private mcpDiscoveryService: McpDiscoveryService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {
    this.serverForm = this.createServerForm();
  }

  ngOnInit(): void {
    // Initialize credentials form
    this.initCredentialsForm();
    
    // Check session status
    this.checkSessionStatus();
    
    // Subscribe to settings changes
    this.subscriptions.push(
      this.mcpSettingsService.settings$.subscribe(settings => {
        this.servers = settings.servers;
        this.cdr.markForCheck();
      })
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  private createServerForm(server?: MCPServerConfig): FormGroup {
    return this.fb.group({
      name: [server?.name || '', [Validators.required]],
      url: [server?.url || ''],
      apiKey: [server?.apiKey || ''],
      model: [server?.model || ''],
      temperature: [server?.temperature || 0.7, [Validators.min(0), Validators.max(1)]],
      maxTokens: [server?.maxTokens || 2048, [Validators.min(1)]],
      isDefault: [server?.isDefault || false],
      serverType: [server?.serverType || MCPServerType.OTHER],
      // AWS Bedrock specific fields
      awsRegion: [server?.awsRegion || 'us-east-1'],
      awsAccessKeyId: [server?.awsAccessKeyId || ''],
      awsSecretAccessKey: [server?.awsSecretAccessKey || '']
    });
  }
  
  startAddServer(): void {
    this.isAddingServer = true;
    this.editingServerId = null;
    this.serverForm = this.createServerForm();
    this.cdr.markForCheck();
  }
  
  startEditServer(server: MCPServerConfig): void {
    this.isAddingServer = false;
    this.editingServerId = server.id;
    this.serverForm = this.createServerForm(server);
    this.cdr.markForCheck();
  }
  
  cancelEdit(): void {
    this.isAddingServer = false;
    this.editingServerId = null;
    this.cdr.markForCheck();
  }
  
  toggleMcpServerConfig(): void {
    this.showMcpServerConfig = !this.showMcpServerConfig;
    this.cdr.markForCheck();
  }
  
  saveServer(): void {
    if (this.serverForm.invalid) {
      return;
    }
    
    const formValue = this.serverForm.value;
    
    if (this.isAddingServer) {
      // Add new server
      const newServer: MCPServerConfig = {
        id: this.generateId(),
        name: formValue.name,
        url: formValue.url,
        apiKey: formValue.apiKey,
        model: formValue.model,
        temperature: formValue.temperature,
        maxTokens: formValue.maxTokens,
        isDefault: formValue.isDefault,
        serverType: formValue.serverType,
        // AWS Bedrock specific fields
        awsRegion: formValue.awsRegion,
        awsAccessKeyId: formValue.awsAccessKeyId,
        awsSecretAccessKey: formValue.awsSecretAccessKey
      };
      
      this.mcpSettingsService.addServer(newServer).subscribe({
        next: () => {
          this.isAddingServer = false;
          // Refresh MCP server status after adding
          this.refreshMcpStatus();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to add server', error);
        }
      });
    } else if (this.editingServerId) {
      // Update existing server
      this.mcpSettingsService.updateServer(this.editingServerId, formValue).subscribe({
        next: () => {
          this.editingServerId = null;
          // Refresh MCP server status after updating
          this.refreshMcpStatus();
          this.cdr.markForCheck();
        },
        error: (error) => {
          console.error('Failed to update server', error);
        }
      });
    }
  }
  
  removeServer(serverId: string): void {
    this.mcpSettingsService.removeServer(serverId).subscribe({
      error: (error) => {
        console.error('Failed to remove server', error);
      }
    });
  }
  
  setDefaultServer(serverId: string): void {
    this.mcpSettingsService.setDefaultServer(serverId).subscribe({
      error: (error) => {
        console.error('Failed to set default server', error);
      }
    });
  }
  
  isDefaultServer(serverId: string): boolean {
    const settings = this.mcpSettingsService.getSettings();
    return settings.defaultServerId === serverId;
  }
  
  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
  
  // Backend Agent Credentials Methods
  
  initCredentialsForm(): void {
    // Try to load credentials from sessionStorage
    const savedCredentials = this.loadCredentialsFromSession();
    
    this.credentialsForm = this.fb.group({
      provider: [savedCredentials?.provider || 'bob', Validators.required],
      apiKey: [savedCredentials?.apiKey || ''],
      model: [savedCredentials?.model || 'claude-3-7-sonnet-20250219'],
      maxTokens: [savedCredentials?.maxTokens || 200000],
      temperature: [savedCredentials?.temperature || 0.7],
      // AWS Bedrock
      region: [savedCredentials?.region || 'us-east-1'],
      accessKeyId: [savedCredentials?.accessKeyId || ''],
      secretAccessKey: [savedCredentials?.secretAccessKey || ''],
      // Custom
      baseURL: [savedCredentials?.baseURL || '']
    });
    
    // Initialize available models for the provider
    this.updateAvailableModels(savedCredentials?.provider || 'bob');
    
    // Watch provider changes to update validators and models
    this.subscriptions.push(
      this.credentialsForm.get('provider')!.valueChanges.subscribe(provider => {
        this.updateCredentialValidators(provider);
        this.updateAvailableModels(provider);
        // Load saved credentials for this provider if available
        this.loadProviderCredentials(provider);
        // Fetch Ollama models if Ollama is selected
        if (provider === 'ollama') {
          this.fetchOllamaModels();
        }
        this.cdr.markForCheck();
      })
    );
    
    // Fetch Ollama models if Ollama is the initial provider
    if (savedCredentials?.provider === 'ollama') {
      this.fetchOllamaModels();
    }
  }
  
  private loadCredentialsFromSession(): CredentialsRequest | null {
    try {
      // Load all saved credentials
      const savedAll = sessionStorage.getItem('bob_credentials_all');
      if (savedAll) {
        const credentialsArray: CredentialsRequest[] = JSON.parse(savedAll);
        // Populate the map
        credentialsArray.forEach(cred => {
          this.savedProviderCredentials.set(cred.provider, cred);
        });
      }
      
      // Load the last used provider
      const lastUsed = sessionStorage.getItem('bob_credentials_last');
      if (lastUsed) {
        return JSON.parse(lastUsed);
      }
      
      // Fallback to old single credential format for backward compatibility
      const saved = sessionStorage.getItem('bob_credentials');
      if (saved) {
        const cred = JSON.parse(saved);
        this.savedProviderCredentials.set(cred.provider, cred);
        return cred;
      }
      
      return null;
    } catch (error) {
      console.error('Error loading credentials from session:', error);
      return null;
    }
  }
  
  private saveCredentialsToSession(credentials: CredentialsRequest): void {
    try {
      // Save to the provider-specific map
      this.savedProviderCredentials.set(credentials.provider, credentials);
      
      // Save all credentials as array
      const credentialsArray = Array.from(this.savedProviderCredentials.values());
      sessionStorage.setItem('bob_credentials_all', JSON.stringify(credentialsArray));
      
      // Save as last used
      sessionStorage.setItem('bob_credentials_last', JSON.stringify(credentials));
      
      // Keep backward compatibility
      sessionStorage.setItem('bob_credentials', JSON.stringify(credentials));
    } catch (error) {
      console.error('Error saving credentials to session:', error);
    }
  }
  
  /**
   * Load saved credentials for a specific provider
   */
  private loadProviderCredentials(provider: string): void {
    const savedCred = this.savedProviderCredentials.get(provider);
    if (savedCred) {
      // Populate form with saved credentials
      // Don't set provider field to avoid triggering valueChanges and causing infinite loop
      this.credentialsForm.patchValue({
        apiKey: savedCred.apiKey || '',
        model: savedCred.model || '',
        maxTokens: savedCred.maxTokens || 4096,
        temperature: savedCred.temperature || 0.7,
        region: savedCred.region || 'us-east-1',
        accessKeyId: savedCred.accessKeyId || '',
        secretAccessKey: savedCred.secretAccessKey || '',
        baseURL: savedCred.baseURL || ''
      }, { emitEvent: false });
      this.cdr.markForCheck();
    }
  }
  
  updateAvailableModels(provider: string): void {
    // Update available models based on provider
    this.availableModels = this.modelsByProvider[provider as keyof typeof this.modelsByProvider] || [];
    
    // Only set default model if there's no current value
    const currentModel = this.credentialsForm.get('model')?.value;
    if (this.availableModels.length > 0 && !currentModel) {
      this.credentialsForm.patchValue({ model: this.availableModels[0].value });
    }
  }
  
  /**
   * Fetch available Ollama models from the backend
   */
  fetchOllamaModels(): void {
    this.loadingOllamaModels = true;
    this.ollamaModelsError = null;
    
    const baseURL = this.credentialsForm.get('baseURL')?.value || 'http://localhost:11434';
    
    this.backendAgent.getOllamaModels(baseURL).subscribe({
      next: (response) => {
        this.loadingOllamaModels = false;
        this.modelsByProvider['ollama'] = response.models;
        this.availableModels = response.models;
        
        // Set first model as default if no model is selected
        const currentModel = this.credentialsForm.get('model')?.value;
        if (response.models.length > 0 && !currentModel) {
          this.credentialsForm.patchValue({ model: response.models[0].value });
        }
        
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadingOllamaModels = false;
        this.ollamaModelsError = 'Failed to fetch Ollama models. Make sure Ollama is running.';
        console.error('Error fetching Ollama models:', err);
        this.cdr.markForCheck();
      }
    });
  }
  
  updateCredentialValidators(provider: string): void {
    const apiKeyControl = this.credentialsForm.get('apiKey');
    const accessKeyControl = this.credentialsForm.get('accessKeyId');
    const secretKeyControl = this.credentialsForm.get('secretAccessKey');
    const baseURLControl = this.credentialsForm.get('baseURL');
    
    // Clear all validators first
    apiKeyControl?.clearValidators();
    accessKeyControl?.clearValidators();
    secretKeyControl?.clearValidators();
    baseURLControl?.clearValidators();
    
    // Set validators based on provider
    if (provider === 'bob' || provider === 'claude' || provider === 'openai') {
      apiKeyControl?.setValidators([Validators.required]);
    } else if (provider === 'bedrock') {
      accessKeyControl?.setValidators([Validators.required]);
      secretKeyControl?.setValidators([Validators.required]);
    } else if (provider === 'ollama') {
      // Ollama doesn't require API key, but baseURL is optional
      baseURLControl?.clearValidators();
    } else if (provider === 'custom') {
      apiKeyControl?.setValidators([Validators.required]);
      baseURLControl?.setValidators([Validators.required]);
    }
    
    // Update validity
    apiKeyControl?.updateValueAndValidity();
    accessKeyControl?.updateValueAndValidity();
    secretKeyControl?.updateValueAndValidity();
    baseURLControl?.updateValueAndValidity();
  }
  
  checkSessionStatus(): void {
    this.backendAgent.checkSessionStatus().subscribe({
      next: (status) => {
        this.sessionStatus = status;
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error checking session status:', err);
        this.sessionStatus = { authenticated: false };
        this.cdr.markForCheck();
      }
    });
  }
  
  submitCredentials(): void {
    if (this.credentialsForm.invalid) {
      return;
    }
    
    this.submittingCredentials = true;
    const credentials: CredentialsRequest = this.credentialsForm.value;
    
    this.backendAgent.submitCredentials(credentials).subscribe({
      next: (response) => {
        console.log('Credentials submitted successfully:', response);
        this.submittingCredentials = false;
        
        // Save credentials to sessionStorage
        this.saveCredentialsToSession(credentials);
        
        this.checkSessionStatus();
        
        // Refresh MCP server status after credentials update
        this.refreshMcpStatus();
        
        // Route to chat page
        this.router.navigate(['/chat']);
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error submitting credentials:', err);
        this.submittingCredentials = false;
        alert(`Error: ${err.error?.message || 'Failed to submit credentials'}`);
        this.cdr.markForCheck();
      }
    });
  }
  
  clearCredentials(): void {
    if (!confirm('Are you sure you want to clear your credentials?')) {
      return;
    }
    
    this.backendAgent.clearCredentials().subscribe({
      next: () => {
        console.log('Credentials cleared');
        
        // Clear all sessionStorage
        sessionStorage.removeItem('bob_credentials');
        sessionStorage.removeItem('bob_credentials_all');
        sessionStorage.removeItem('bob_credentials_last');
        this.savedProviderCredentials.clear();
        
        this.sessionStatus = { authenticated: false };
        this.credentialsForm.reset({ provider: 'bob' });
        alert('Credentials cleared successfully');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error clearing credentials:', err);
        alert('Error clearing credentials');
        this.cdr.markForCheck();
      }
    });
  }
  
  logout(): void {
    if (!confirm('Are you sure you want to logout?')) {
      return;
    }
    
    this.backendAgent.logout().subscribe({
      next: () => {
        console.log('Logged out');
        
        // Clear all sessionStorage
        sessionStorage.removeItem('bob_credentials');
        sessionStorage.removeItem('bob_credentials_all');
        sessionStorage.removeItem('bob_credentials_last');
        this.savedProviderCredentials.clear();
        
        this.sessionStatus = { authenticated: false };
        this.credentialsForm.reset({ provider: 'bob' });
        alert('Logged out successfully');
        this.cdr.markForCheck();
      },
      error: (err) => {
        console.error('Error logging out:', err);
        this.cdr.markForCheck();
      }
    });
  }
  
  toggleApiKeyVisibility(): void {
    this.showApiKey = !this.showApiKey;
  }
  
  toggleAwsSecretVisibility(): void {
    this.showAwsSecret = !this.showAwsSecret;
  }
  
  /**
   * Refresh MCP server status from backend
   * This will update the server list in the mcp-server-menu component
   */
  async refreshMcpStatus(): Promise<void> {
    try {
      console.log('Refreshing MCP server status...');
      await this.mcpDiscoveryService.refreshServerStatus();
      console.log('MCP server status refreshed successfully');
      this.cdr.markForCheck();
    } catch (err) {
      console.error('Error refreshing MCP server status:', err);
    }
  }
  
  /**
   * Get list of saved provider names
   */
  getSavedProviders(): string[] {
    return Array.from(this.savedProviderCredentials.keys());
  }
  
  /**
   * Switch to a saved provider
   */
  switchToProvider(provider: string): void {
    this.credentialsForm.patchValue({ provider });
    this.loadProviderCredentials(provider);
  }
  
  /**
   * Get display name for provider
   */
  getProviderDisplayName(provider: string): string {
    const names: Record<string, string> = {
      'bob': 'Bob',
      'claude': 'Claude',
      'openai': 'OpenAI',
      'bedrock': 'Bedrock',
      'ollama': 'Ollama',
      'custom': 'Custom'
    };
    return names[provider] || provider;
  }
  
  /**
   * Get model name for saved provider
   */
  getProviderModel(provider: string): string {
    const cred = this.savedProviderCredentials.get(provider);
    if (!cred) return '';
    
    // Shorten model names for display
    const model = cred.model || '';
    if (model.includes('claude-3-7')) return 'Claude 3.7';
    if (model.includes('claude-3-5')) return 'Claude 3.5';
    if (model.includes('claude-3-opus')) return 'Claude 3 Opus';
    if (model.includes('gpt-4o')) return 'GPT-4o';
    if (model.includes('gpt-4-turbo')) return 'GPT-4 Turbo';
    if (model.includes('gpt-4')) return 'GPT-4';
    if (model.includes('o1-preview')) return 'O1 Preview';
    return model.substring(0, 20);
  }
}

// Made with Bob
