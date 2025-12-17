import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, from, firstValueFrom } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { IndexedDBService } from './indexed-db.service';
import { BackendAgentService } from './backend-agent.service';
import { McpConfiguration, McpServerStatus, parseAllMcpServers } from '../models/mcp-config.model';

@Injectable({
  providedIn: 'root'
})
export class McpDiscoveryService {
  private serversStatusSubject = new BehaviorSubject<McpServerStatus[]>([]);
  public serversStatus$ = this.serversStatusSubject.asObservable();
  
  private initializedSubject = new BehaviorSubject<boolean>(false);
  public initialized$ = this.initializedSubject.asObservable();
  
  private discoveryInProgress = false;

  constructor(
    private indexedDBService: IndexedDBService,
    private backendAgentService: BackendAgentService
  ) {}

  /**
   * Initialize MCP discovery on app startup
   * Loads configuration from IndexedDB and sends to backend
   */
  async initialize(): Promise<void> {
    try {
      console.log('Initializing MCP discovery...');
      
      // Load configuration from IndexedDB
      const config = await this.indexedDBService.loadConfiguration();
      
      if (config && Object.keys(config.mcpServers).length > 0) {
        console.log('Found MCP configuration, sending to backend...');
        await this.discoverServers(config);
      } else {
        console.log('No MCP servers configured');
        // Mark as initialized even if no servers configured
        this.initializedSubject.next(true);
      }
    } catch (error) {
      console.error('Error initializing MCP discovery:', error);
      // Mark as initialized even on error to not block UI
      this.initializedSubject.next(true);
    }
  }

  /**
   * Discover MCP servers from configuration
   * Sends configuration to backend and gets server status
   */
  async discoverServers(config: McpConfiguration): Promise<void> {
    if (this.discoveryInProgress) {
      console.log('Discovery already in progress, skipping...');
      return;
    }

    this.discoveryInProgress = true;

    try {
      console.log('Discovering MCP servers...', config);
      
      // Parse servers to get basic info
      const parsedServers = parseAllMcpServers(config);
      console.log('Parsed servers:', parsedServers);
      
      // Send configuration to backend using firstValueFrom instead of deprecated toPromise()
      const response = await firstValueFrom(this.backendAgentService.submitMcpConfiguration(config));
      console.log('Backend response:', response);
      
      // Initialize server status with disconnected state
      const serverStatuses: McpServerStatus[] = parsedServers.map(server => ({
        name: server.name,
        connected: false,
        toolCount: 0,
        tools: []
      }));
      
      this.serversStatusSubject.next(serverStatuses);
      
      console.log(`Discovered ${parsedServers.length} MCP servers`);
      
      // Wait a moment for backend to connect, then refresh status
      setTimeout(() => {
        this.refreshServerStatus()
          .then(() => {
            // Mark as initialized after status refresh completes
            this.initializedSubject.next(true);
          })
          .catch(err => {
            console.error('Error refreshing status after discovery:', err);
            // Mark as initialized even on error to not block UI
            this.initializedSubject.next(true);
          });
      }, 1000);
      
    } catch (error) {
      console.error('Error discovering MCP servers:', error);
      // Mark as initialized even on error to not block UI
      this.initializedSubject.next(true);
      throw error;
    } finally {
      this.discoveryInProgress = false;
    }
  }

  /**
   * Refresh server status from backend
   * Gets actual connection status and tool counts
   */
  async refreshServerStatus(): Promise<void> {
    try {
      console.log('Refreshing server status from backend...');
      
      const response = await firstValueFrom(this.backendAgentService.getMcpServerStatus());
      
      if (response && response.servers) {
        const serverStatuses: McpServerStatus[] = response.servers.map(server => ({
          name: server.name,
          connected: server.connected,
          toolCount: server.toolCount,
          tools: server.tools || []
        }));
        
        this.serversStatusSubject.next(serverStatuses);
        console.log('Server status refreshed:', serverStatuses);
      }
    } catch (error: any) {
      // Handle 401 errors gracefully (no credentials configured)
      if (error.status === 401) {
        console.log('No credentials configured, cannot refresh server status');
      } else {
        console.error('Error refreshing server status:', error);
      }
    }
  }

  /**
   * Get current server status
   */
  getCurrentStatus(): McpServerStatus[] {
    return this.serversStatusSubject.value;
  }

  /**
   * Update configuration and rediscover servers
   */
  async updateConfiguration(config: McpConfiguration): Promise<void> {
    // Save to IndexedDB
    await this.indexedDBService.saveConfiguration(config);
    
    // Rediscover servers
    await this.discoverServers(config);
  }

  /**
   * Manually refresh server status (can be called from UI)
   */
  async manualRefresh(): Promise<void> {
    await this.refreshServerStatus();
  }
}

// Made with Bob
