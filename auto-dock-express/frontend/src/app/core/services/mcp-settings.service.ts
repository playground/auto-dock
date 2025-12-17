import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { MCPSettings, MCPServerConfig, DEFAULT_MCP_SETTINGS, MCPServerType } from '../models/mcp-settings.model';
import { IndexedDBService } from './indexed-db.service';

@Injectable({
  providedIn: 'root'
})
export class MCPSettingsService {
  private settings = new BehaviorSubject<MCPSettings>(DEFAULT_MCP_SETTINGS);
  public settings$ = this.settings.asObservable();
  
  private readonly SETTINGS_KEY = 'bob_desktop_settings.json';
  private migrationComplete = false;

  constructor(
    private http: HttpClient,
    private indexedDB: IndexedDBService
  ) {
    // Load settings with migration from localStorage to IndexedDB
    this.loadSettingsWithMigration();
  }

  /**
   * Load settings from IndexedDB, migrating from localStorage if needed
   */
  private loadSettingsWithMigration(): void {
    // First, try to load from IndexedDB
    this.indexedDB.get<MCPSettings>(this.SETTINGS_KEY)
      .pipe(
        switchMap((settings: MCPSettings | null) => {
          if (settings) {
            // Settings found in IndexedDB
            console.log('Loaded settings from IndexedDB');
            this.migrationComplete = true;
            return of(settings);
          } else {
            // No settings in IndexedDB, try to migrate from localStorage
            console.log('No settings in IndexedDB, checking localStorage for migration');
            return this.migrateFromLocalStorage();
          }
        }),
        catchError(error => {
          console.error('Error loading settings:', error);
          // Try to migrate from localStorage as fallback
          return this.migrateFromLocalStorage();
        })
      )
      .subscribe((settings: MCPSettings) => {
        this.settings.next(settings);
      });
  }

  /**
   * Migrate settings from localStorage to IndexedDB
   */
  private migrateFromLocalStorage(): Observable<MCPSettings> {
    console.log('Attempting to migrate settings from localStorage');
    
    const storedSettings = localStorage.getItem(this.SETTINGS_KEY);
    
    if (storedSettings) {
      try {
        const settings = JSON.parse(storedSettings) as MCPSettings;
        console.log('Found settings in localStorage, migrating to IndexedDB');
        
        // Save to IndexedDB
        return this.indexedDB.set(this.SETTINGS_KEY, settings).pipe(
          map(() => {
            console.log('Successfully migrated settings to IndexedDB');
            this.migrationComplete = true;
            
            // Clean up localStorage after successful migration
            localStorage.removeItem(this.SETTINGS_KEY);
            console.log('Cleaned up localStorage');
            
            return settings;
          }),
          catchError(error => {
            console.error('Failed to migrate settings to IndexedDB:', error);
            // Return the settings anyway, even if migration failed
            return of(settings);
          })
        );
      } catch (error) {
        console.error('Failed to parse stored settings from localStorage:', error);
      }
    }
    
    console.log('No settings found in localStorage, using defaults');
    return of(DEFAULT_MCP_SETTINGS);
  }

  /**
   * Save settings to IndexedDB
   */
  private saveSettings(settings: MCPSettings): Observable<boolean> {
    return this.indexedDB.set(this.SETTINGS_KEY, settings).pipe(
      map(() => {
        console.log('Settings saved to IndexedDB');
        return true;
      }),
      catchError(error => {
        console.error('Failed to save settings to IndexedDB:', error);
        return of(false);
      })
    );
  }

  /**
   * Get current settings
   */
  getSettings(): MCPSettings {
    return this.settings.value;
  }

  /**
   * Update settings
   */
  updateSettings(settings: Partial<MCPSettings>): Observable<boolean> {
    const updatedSettings = {
      ...this.settings.value,
      ...settings
    };
    
    this.settings.next(updatedSettings);
    return this.saveSettings(updatedSettings);
  }

  /**
   * Add a new MCP server
   */
  addServer(server: MCPServerConfig): Observable<boolean> {
    const currentSettings = this.settings.value;
    const servers = [...currentSettings.servers, server];
    
    // If this is the first server or marked as default, set it as default
    let defaultServerId = currentSettings.defaultServerId;
    if (!defaultServerId || server.isDefault) {
      defaultServerId = server.id;
    }
    
    const updatedSettings = {
      ...currentSettings,
      servers,
      defaultServerId
    };
    
    this.settings.next(updatedSettings);
    return this.saveSettings(updatedSettings);
  }

  /**
   * Update an existing MCP server
   */
  updateServer(serverId: string, updates: Partial<MCPServerConfig>): Observable<boolean> {
    const currentSettings = this.settings.value;
    const servers = currentSettings.servers.map(server => 
      server.id === serverId ? { ...server, ...updates } : server
    );
    
    // If this server is marked as default, update the default server ID
    let defaultServerId = currentSettings.defaultServerId;
    if (updates.isDefault) {
      defaultServerId = serverId;
    }
    
    const updatedSettings = {
      ...currentSettings,
      servers,
      defaultServerId
    };
    
    this.settings.next(updatedSettings);
    return this.saveSettings(updatedSettings);
  }

  /**
   * Remove an MCP server
   */
  removeServer(serverId: string): Observable<boolean> {
    const currentSettings = this.settings.value;
    const servers = currentSettings.servers.filter(server => server.id !== serverId);
    
    // If the removed server was the default, set a new default if possible
    let defaultServerId = currentSettings.defaultServerId;
    if (defaultServerId === serverId && servers.length > 0) {
      defaultServerId = servers[0].id;
    } else if (servers.length === 0) {
      defaultServerId = undefined;
    }
    
    const updatedSettings = {
      ...currentSettings,
      servers,
      defaultServerId
    };
    
    this.settings.next(updatedSettings);
    return this.saveSettings(updatedSettings);
  }

  /**
   * Get the default MCP server
   */
  getDefaultServer(): MCPServerConfig | undefined {
    const currentSettings = this.settings.value;
    if (!currentSettings.defaultServerId) {
      return undefined;
    }
    
    return currentSettings.servers.find(server => 
      server.id === currentSettings.defaultServerId
    );
  }

  /**
   * Set the default MCP server
   */
  setDefaultServer(serverId: string): Observable<boolean> {
    const currentSettings = this.settings.value;
    const serverExists = currentSettings.servers.some(server => server.id === serverId);
    
    if (!serverExists) {
      return of(false);
    }
    
    const updatedSettings = {
      ...currentSettings,
      defaultServerId: serverId
    };
    
    this.settings.next(updatedSettings);
    return this.saveSettings(updatedSettings);
  }

  /**
   * Check if migration from localStorage is complete
   */
  isMigrationComplete(): boolean {
    return this.migrationComplete;
  }
}

// Made with Bob
