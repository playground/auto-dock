import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IndexedDBService } from '../../../core/services/indexed-db.service';
import { McpDiscoveryService } from '../../../core/services/mcp-discovery.service';
import { McpConfiguration, EXAMPLE_MCP_CONFIG } from '../../../core/models/mcp-config.model';

@Component({
  selector: 'app-mcp-config-editor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './mcp-config-editor.component.html',
  styleUrls: ['./mcp-config-editor.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class McpConfigEditorComponent implements OnInit {
  configJson: string = '';
  errorMessage: string = '';
  successMessage: string = '';
  isLoading: boolean = false;
  isSensitiveDataMasked: boolean = true;
  private originalConfigJson: string = '';

  constructor(
    private indexedDBService: IndexedDBService,
    private mcpDiscoveryService: McpDiscoveryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize with example config immediately to avoid loading state
    this.configJson = JSON.stringify(EXAMPLE_MCP_CONFIG, null, 2);
    this.originalConfigJson = this.configJson;
    this.applyMasking();
    this.cdr.markForCheck();
    
    // Then try to load saved config in background
    this.loadConfiguration();
  }

  /**
   * Load current configuration from IndexedDB
   */
  async loadConfiguration(): Promise<void> {
    try {
      const config = await this.indexedDBService.loadConfiguration();
      
      if (config && Object.keys(config.mcpServers).length > 0) {
        this.configJson = JSON.stringify(config, null, 2);
        this.originalConfigJson = this.configJson;
        this.applyMasking();
        this.cdr.markForCheck();
      }
      // If no config, keep the example that was already loaded
    } catch (error) {
      console.error('Error loading configuration:', error);
      // Keep the example config that was already set
    }
  }

  /**
   * Save configuration
   */
  async saveConfiguration(): Promise<void> {
    this.errorMessage = '';
    this.successMessage = '';

    try {
      // If data is masked, we need to merge user edits with original unmasked values
      let configToSave: McpConfiguration;
      
      if (this.isSensitiveDataMasked && this.originalConfigJson) {
        // Parse both the current (possibly edited) masked config and the original unmasked config
        const editedConfig = JSON.parse(this.configJson);
        const originalConfig = JSON.parse(this.originalConfigJson);
        
        // Merge: use edited structure but restore original sensitive values
        configToSave = this.restoreSensitiveData(editedConfig, originalConfig);
      } else {
        // No masking, just parse the current config
        configToSave = JSON.parse(this.configJson);
      }

      // Validate structure
      if (!configToSave.mcpServers || typeof configToSave.mcpServers !== 'object') {
        throw new Error('Invalid configuration: mcpServers must be an object');
      }

      // Validate each server
      for (const [name, serverConfig] of Object.entries(configToSave.mcpServers)) {
        if (!serverConfig.command) {
          throw new Error(`Server "${name}" is missing required field: command`);
        }
        if (!Array.isArray(serverConfig.args)) {
          throw new Error(`Server "${name}" is missing required field: args (must be an array)`);
        }
      }

      this.isLoading = true;
      this.cdr.markForCheck();

      console.log('Saving configuration...', configToSave);

      // Save to IndexedDB first
      try {
        console.log('About to save to IndexedDB...');
        console.log('IndexedDB service:', this.indexedDBService);
        console.log('Calling saveConfiguration with config:', configToSave);
        
        const savePromise = this.indexedDBService.saveConfiguration(configToSave);
        console.log('Save promise created:', savePromise);
        
        await savePromise;
        console.log('Saved to IndexedDB successfully');
        
        // Update the original config to the saved version
        this.originalConfigJson = JSON.stringify(configToSave, null, 2);
        
        // Reapply masking if enabled
        if (this.isSensitiveDataMasked) {
          this.applyMasking();
        } else {
          this.configJson = this.originalConfigJson;
        }
      } catch (dbError) {
        console.error('IndexedDB save failed:', dbError);
        throw new Error(`Failed to save to IndexedDB: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }

      // Try to send to backend, but don't fail if it doesn't work
      try {
        console.log('About to send to backend...');
        await this.mcpDiscoveryService.discoverServers(configToSave);
        console.log('Sent to backend successfully');
      } catch (backendError) {
        console.warn('Failed to send to backend, but IndexedDB save succeeded:', backendError);
      }

      this.successMessage = `Configuration saved successfully! ${Object.keys(configToSave.mcpServers).length} server(s) configured.`;
      this.isLoading = false;
      this.cdr.markForCheck();

      // Clear success message after 3 seconds
      setTimeout(() => {
        this.successMessage = '';
        this.cdr.markForCheck();
      }, 3000);
    } catch (error) {
      console.error('Error saving configuration:', error);
      this.errorMessage = error instanceof Error ? error.message : 'Failed to save configuration';
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Reset to example configuration
   */
  loadExample(): void {
    this.configJson = JSON.stringify(EXAMPLE_MCP_CONFIG, null, 2);
    this.originalConfigJson = this.configJson;
    this.applyMasking();
    this.errorMessage = '';
    this.successMessage = '';
    this.cdr.markForCheck();
  }

  /**
   * Clear configuration
   */
  async clearConfiguration(): Promise<void> {
    if (!confirm('Are you sure you want to clear the MCP configuration?')) {
      return;
    }

    try {
      this.isLoading = true;
      await this.indexedDBService.clearConfiguration();
      this.configJson = JSON.stringify({ mcpServers: {} }, null, 2);
      this.successMessage = 'Configuration cleared successfully';
      this.isLoading = false;
      this.cdr.markForCheck();

      setTimeout(() => {
        this.successMessage = '';
        this.cdr.markForCheck();
      }, 3000);
    } catch (error) {
      console.error('Error clearing configuration:', error);
      this.errorMessage = 'Failed to clear configuration';
      this.isLoading = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Format JSON
   */
  formatJson(): void {
    try {
      const config = JSON.parse(this.configJson);
      this.configJson = JSON.stringify(config, null, 2);
      this.errorMessage = '';
      this.cdr.markForCheck();
    } catch (error) {
      this.errorMessage = 'Invalid JSON format';
      this.cdr.markForCheck();
    }
  }

  /**
   * Export configuration to file
   */
  exportConfiguration(): void {
    try {
      // Always export the original unmasked configuration
      const configToExport = this.originalConfigJson || this.configJson;
      const config = JSON.parse(configToExport);
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'mcp-config.json';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      this.errorMessage = 'Failed to export configuration';
      this.cdr.markForCheck();
    }
  }

  /**
   * Import configuration from file
   */
  importConfiguration(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const config = JSON.parse(content);
        
        // Validate
        if (!config.mcpServers || typeof config.mcpServers !== 'object') {
          throw new Error('Invalid configuration format');
        }

        this.configJson = JSON.stringify(config, null, 2);
        this.originalConfigJson = this.configJson;
        this.applyMasking();
        this.errorMessage = '';
        this.successMessage = 'Configuration imported successfully. Click Save to apply.';
        this.cdr.markForCheck();

        setTimeout(() => {
          this.successMessage = '';
          this.cdr.markForCheck();
        }, 3000);
      } catch (error) {
        this.errorMessage = 'Failed to import configuration: Invalid JSON';
        this.cdr.markForCheck();
      }
    };

    reader.readAsText(file);
    
    // Reset input
    input.value = '';
  }

  /**
   * Toggle sensitive data masking
   */
  toggleSensitiveDataMasking(): void {
    this.isSensitiveDataMasked = !this.isSensitiveDataMasked;
    
    if (this.isSensitiveDataMasked) {
      this.applyMasking();
    } else {
      this.configJson = this.originalConfigJson;
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Apply masking to sensitive data in the configuration
   */
  private applyMasking(): void {
    if (!this.isSensitiveDataMasked) {
      return;
    }

    try {
      // Store original if not already stored
      if (!this.originalConfigJson || this.originalConfigJson === '') {
        this.originalConfigJson = this.configJson;
      }

      // Parse the JSON
      const config = JSON.parse(this.originalConfigJson);
      
      // Mask sensitive data
      this.maskSensitiveData(config);
      
      // Convert back to JSON string
      this.configJson = JSON.stringify(config, null, 2);
    } catch (error) {
      // If parsing fails, keep the original
      console.error('Error applying masking:', error);
    }
  }

  /**
   * Recursively mask sensitive data in an object
   */
  private maskSensitiveData(obj: any): void {
    const sensitiveKeys = [
      'api-key', 'apikey', 'api_key',
      'password', 'passwd', 'pwd',
      'token', 'auth', 'authorization',
      'credential', 'secret', 'key',
      'bearer', 'access_token', 'refresh_token'
    ];

    if (typeof obj !== 'object' || obj === null) {
      return;
    }

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const lowerKey = key.toLowerCase();
        
        // Check if the key is sensitive
        const isSensitiveKey = sensitiveKeys.some(sensitiveKey =>
          lowerKey.includes(sensitiveKey)
        );

        if (typeof obj[key] === 'string') {
          // Mask string values for sensitive keys
          if (isSensitiveKey) {
            obj[key] = '••••••••';
          } else {
            // Check if the value contains sensitive patterns (e.g., "api-key:value")
            obj[key] = this.maskSensitivePatterns(obj[key]);
          }
        } else if (Array.isArray(obj[key])) {
          // Process arrays
          obj[key] = obj[key].map((item: any) => {
            if (typeof item === 'string') {
              return this.maskSensitivePatterns(item);
            } else if (typeof item === 'object') {
              this.maskSensitiveData(item);
              return item;
            }
            return item;
          });
        } else if (typeof obj[key] === 'object') {
          // Recursively process nested objects
          this.maskSensitiveData(obj[key]);
        }
      }
    }
  }

  /**
   * Mask sensitive patterns in strings (e.g., "api-key:value" or "Bearer token")
   */
  private maskSensitivePatterns(value: string): string {
    const patterns = [
      // Header format: "key:value" - captures everything after colon until comma, quote, or closing brace
      /(api[-_]?key|apikey|password|passwd|pwd|token|auth|authorization|credential|secret|access[-_]?token|refresh[-_]?token)\s*:\s*[^,}"]+/gi,
      // Bearer token format - captures everything after "Bearer " until comma, quote, or closing brace
      /Bearer\s+[^,}"]+/gi,
      // Environment variable format: $VAR_NAME or ${VAR_NAME}
      /\$\{?(API[-_]?KEY|PASSWORD|TOKEN|AUTH|CREDENTIAL|SECRET|BEARER|ACCESS[-_]?TOKEN|REFRESH[-_]?TOKEN)[^}]*\}?/gi
    ];

    let maskedValue = value;
    patterns.forEach(pattern => {
      maskedValue = maskedValue.replace(pattern, (match) => {
        // Keep the key part, mask the value part
        const colonIndex = match.indexOf(':');
        if (colonIndex !== -1) {
          return match.substring(0, colonIndex + 1) + '••••••••';
        }
        // For Bearer tokens, keep "Bearer " prefix
        if (match.toLowerCase().startsWith('bearer ')) {
          return 'Bearer ••••••••';
        }
        // For environment variables, mask the whole thing
        return '••••••••';
      });
    });

    return maskedValue;
  }

  /**
   * Restore sensitive data from original config into edited config
   * This merges user edits with original unmasked sensitive values
   */
  private restoreSensitiveData(editedConfig: any, originalConfig: any): any {
    const sensitiveKeys = [
      'api-key', 'apikey', 'api_key',
      'password', 'passwd', 'pwd',
      'token', 'auth', 'authorization',
      'credential', 'secret', 'key',
      'bearer', 'access_token', 'refresh_token'
    ];

    // Deep clone the edited config to avoid mutations
    const result = JSON.parse(JSON.stringify(editedConfig));

    // Recursively restore sensitive values
    this.restoreSensitiveDataRecursive(result, originalConfig, sensitiveKeys);

    return result;
  }

  /**
   * Recursively restore sensitive data
   */
  private restoreSensitiveDataRecursive(edited: any, original: any, sensitiveKeys: string[]): void {
    if (typeof edited !== 'object' || edited === null || typeof original !== 'object' || original === null) {
      return;
    }

    for (const key in edited) {
      if (!edited.hasOwnProperty(key)) {
        continue;
      }

      const lowerKey = key.toLowerCase();
      const isSensitiveKey = sensitiveKeys.some(sensitiveKey => lowerKey.includes(sensitiveKey));

      if (typeof edited[key] === 'string') {
        // If this is a sensitive key and the value is masked, restore from original
        if (isSensitiveKey && edited[key] === '••••••••' && original[key]) {
          edited[key] = original[key];
        } else if (typeof edited[key] === 'string' && edited[key].includes('••••••••')) {
          // Restore masked patterns in strings
          edited[key] = this.restoreSensitivePatterns(edited[key], original[key] || edited[key]);
        }
      } else if (Array.isArray(edited[key]) && Array.isArray(original[key])) {
        // Process arrays - restore masked values
        for (let i = 0; i < edited[key].length; i++) {
          if (typeof edited[key][i] === 'string' && edited[key][i].includes('••••••••')) {
            // Try to find matching original value
            if (i < original[key].length && typeof original[key][i] === 'string') {
              edited[key][i] = this.restoreSensitivePatterns(edited[key][i], original[key][i]);
            }
          } else if (typeof edited[key][i] === 'object' && typeof original[key][i] === 'object') {
            this.restoreSensitiveDataRecursive(edited[key][i], original[key][i], sensitiveKeys);
          }
        }
      } else if (typeof edited[key] === 'object' && typeof original[key] === 'object') {
        // Recursively process nested objects
        this.restoreSensitiveDataRecursive(edited[key], original[key], sensitiveKeys);
      }
    }
  }

  /**
   * Restore sensitive patterns in strings by replacing masked portions with original values
   */
  private restoreSensitivePatterns(maskedValue: string, originalValue: string): string {
    if (!maskedValue.includes('••••••••')) {
      return maskedValue;
    }

    // If the entire value is masked, return the original
    if (maskedValue.trim() === '••••••••') {
      return originalValue;
    }

    // For patterns like "api-key:••••••••", restore the value part
    const patterns = [
      /(api[-_]?key|apikey|password|passwd|pwd|token|auth|authorization|credential|secret|access[-_]?token|refresh[-_]?token)\s*:\s*••••••••/gi,
      /Bearer\s+••••••••/gi
    ];

    let restoredValue = maskedValue;
    patterns.forEach(pattern => {
      restoredValue = restoredValue.replace(pattern, (match) => {
        // Find the corresponding part in the original value
        const colonIndex = match.indexOf(':');
        if (colonIndex !== -1) {
          // Extract the key part from masked value
          const keyPart = match.substring(0, colonIndex + 1);
          // Find the same key in original and extract its value
          const originalMatch = originalValue.match(new RegExp(keyPart.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*([^,}"]+)', 'i'));
          if (originalMatch && originalMatch[1]) {
            return keyPart + originalMatch[1];
          }
        } else if (match.toLowerCase().startsWith('bearer ')) {
          // For Bearer tokens, extract from original
          const bearerMatch = originalValue.match(/Bearer\s+([^,}"]+)/i);
          if (bearerMatch && bearerMatch[1]) {
            return 'Bearer ' + bearerMatch[1];
          }
        }
        return match;
      });
    });

    // If still masked, return original
    if (restoredValue.includes('••••••••')) {
      return originalValue;
    }

    return restoredValue;
  }

  /**
   * Handle configuration changes in the textarea
   */
  onConfigChange(value: string): void {
    this.configJson = value;
    
    // If masking is disabled, also update the original config
    if (!this.isSensitiveDataMasked) {
      this.originalConfigJson = value;
    }
  }
}

// Made with Bob
