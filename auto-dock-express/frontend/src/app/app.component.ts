import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { MCPSettingsService } from './core/services/mcp-settings.service';
import { MCPServerConfig } from './core/models/mcp-settings.model';
import { McpDiscoveryService } from './core/services/mcp-discovery.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  title = 'MCP Orchestrator';
  mcpServers: MCPServerConfig[] = [];
  defaultServer?: MCPServerConfig;

  constructor(
    private mcpSettingsService: MCPSettingsService,
    private mcpDiscoveryService: McpDiscoveryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Initialize MCP discovery on app startup
    this.mcpDiscoveryService.initialize();
    
    // Check for dark mode preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Listen for changes in color scheme preference
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', event => {
      if (event.matches) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    });
    
    // Subscribe to MCP settings changes
    this.mcpSettingsService.settings$.subscribe(settings => {
      this.mcpServers = settings.servers;
      this.defaultServer = this.mcpServers.find(server =>
        server.id === settings.defaultServerId
      );
      
      // Log discovered servers
      if (this.mcpServers.length > 0) {
        console.log('MCP Servers available:', this.mcpServers.map(s => ({
          name: s.name,
          url: s.url,
          isDefault: s.id === settings.defaultServerId
        })));
      }
      
      // Force change detection
      this.cdr.detectChanges();
    });
  }
}

// Made with Bob
