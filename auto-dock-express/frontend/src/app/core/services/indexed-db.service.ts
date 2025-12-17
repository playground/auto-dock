import { Injectable } from '@angular/core';
import { Observable, from, throwError, BehaviorSubject } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { McpConfiguration, DEFAULT_MCP_CONFIG } from '../models/mcp-config.model';

/**
 * Service for managing IndexedDB operations
 * Provides a simple key-value store interface for PWA data persistence
 */
@Injectable({
  providedIn: 'root'
})
export class IndexedDBService {
  private readonly DB_NAME = 'BobDesktopDB';
  private readonly DB_VERSION = 2;
  private readonly STORE_NAME = 'settings';
  private readonly MCP_STORE_NAME = 'mcpConfiguration';
  private readonly CONFIG_KEY = 'mcp_servers_config';
  private db: IDBDatabase | null = null;
  private configSubject = new BehaviorSubject<McpConfiguration>(DEFAULT_MCP_CONFIG);
  private initPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    // Don't initialize in constructor - let it be lazy loaded
    console.log('IndexedDBService constructed (database not initialized yet)');
  }

  /**
   * Initialize the IndexedDB database
   */
  private initDB(): Promise<IDBDatabase> {
    // If already initializing, return the existing promise
    if (this.initPromise) {
      console.log('Database initialization already in progress, waiting...');
      return this.initPromise;
    }
    
    // If already initialized, return immediately
    if (this.db) {
      console.log('Database already initialized');
      return Promise.resolve(this.db);
    }
    
    // Create and store the initialization promise
    this.initPromise = new Promise((resolve, reject) => {
      console.log('Opening IndexedDB...');
      const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

      request.onblocked = () => {
        console.warn('IndexedDB open request is blocked - another connection is open');
        reject(new Error('Database is blocked by another connection'));
      };

      request.onerror = () => {
        console.error('Failed to open IndexedDB:', request.error);
        this.initPromise = null;
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('IndexedDB initialized successfully');
        this.initPromise = null;
        resolve(this.db);
      };

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        console.log('Database upgrade needed');
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object stores if they don't exist
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME);
          console.log('Created object store:', this.STORE_NAME);
        }
        
        if (!db.objectStoreNames.contains(this.MCP_STORE_NAME)) {
          db.createObjectStore(this.MCP_STORE_NAME);
          console.log('Created object store:', this.MCP_STORE_NAME);
        }
      };
    });
    
    return this.initPromise;
  }

  /**
   * Get a value from IndexedDB
   */
  get<T>(key: string): Observable<T | null> {
    console.log(`Getting key "${key}" from IndexedDB...`);
    
    return from(
      this.initDB().then(db => {
        return new Promise<T | null>((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readonly');
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.get(key);

          request.onsuccess = () => {
            const result = request.result;
            console.log(`Got key "${key}" from IndexedDB:`, result !== undefined ? `${JSON.stringify(result).substring(0, 100)}...` : 'undefined');
            resolve(result !== undefined ? result : null);
          };

          request.onerror = () => {
            console.error(`Error getting key "${key}" from IndexedDB:`, request.error);
            reject(request.error);
          };
        });
      })
    ).pipe(
      catchError(error => {
        console.error(`Failed to get key "${key}" from IndexedDB:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Set a value in IndexedDB
   */
  set<T>(key: string, value: T): Observable<void> {
    console.log(`Setting key "${key}" in IndexedDB with value:`, JSON.stringify(value).substring(0, 100) + '...');
    
    return from(
      this.initDB().then(db => {
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.put(value, key);

          request.onsuccess = () => {
            console.log(`Successfully set key "${key}" in IndexedDB`);
            resolve();
          };

          request.onerror = () => {
            console.error(`Error setting key "${key}" in IndexedDB:`, request.error);
            reject(request.error);
          };
        });
      })
    ).pipe(
      catchError(error => {
        console.error(`Failed to set key "${key}" in IndexedDB:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Delete a value from IndexedDB
   */
  delete(key: string): Observable<void> {
    return from(
      this.initDB().then(db => {
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.delete(key);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            console.error('Error deleting value from IndexedDB:', request.error);
            reject(request.error);
          };
        });
      })
    ).pipe(
      catchError(error => {
        console.error(`Failed to delete key "${key}" from IndexedDB:`, error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Clear all data from IndexedDB
   */
  clear(): Observable<void> {
    return from(
      this.initDB().then(db => {
        return new Promise<void>((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.clear();

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            console.error('Error clearing IndexedDB:', request.error);
            reject(request.error);
          };
        });
      })
    ).pipe(
      catchError(error => {
        console.error('Failed to clear IndexedDB:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Get all keys from IndexedDB
   */
  getAllKeys(): Observable<string[]> {
    return from(
      this.initDB().then(db => {
        return new Promise<string[]>((resolve, reject) => {
          const transaction = db.transaction([this.STORE_NAME], 'readonly');
          const store = transaction.objectStore(this.STORE_NAME);
          const request = store.getAllKeys();

          request.onsuccess = () => {
            resolve(request.result as string[]);
          };

          request.onerror = () => {
            console.error('Error getting all keys from IndexedDB:', request.error);
            reject(request.error);
          };
        });
      })
    ).pipe(
      catchError(error => {
        console.error('Failed to get all keys from IndexedDB:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if a key exists in IndexedDB
   */
  has(key: string): Observable<boolean> {
    return this.get(key).pipe(
      map(value => value !== null),
      catchError(() => from([false]))
    );
  }

  /**
   * Get MCP configuration as Observable
   */
  getConfiguration$(): Observable<McpConfiguration> {
    return this.configSubject.asObservable();
  }
  
  /**
   * Get current MCP configuration
   */
  getCurrentConfiguration(): McpConfiguration {
    return this.configSubject.value;
  }
  
  /**
   * Load MCP configuration from IndexedDB
   */
  async loadConfiguration(): Promise<McpConfiguration> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([this.MCP_STORE_NAME], 'readonly');
          const store = transaction.objectStore(this.MCP_STORE_NAME);
          const request = store.get(this.CONFIG_KEY);
          
          request.onsuccess = () => {
            const config = request.result || DEFAULT_MCP_CONFIG;
            this.configSubject.next(config);
            console.log('Loaded MCP configuration:', config);
            resolve(config);
          };
          
          request.onerror = () => {
            console.error('Error loading configuration:', request.error);
            // Return default config on error instead of rejecting
            this.configSubject.next(DEFAULT_MCP_CONFIG);
            resolve(DEFAULT_MCP_CONFIG);
          };
        } catch (error) {
          console.error('Exception loading configuration:', error);
          this.configSubject.next(DEFAULT_MCP_CONFIG);
          resolve(DEFAULT_MCP_CONFIG);
        }
      });
    } catch (error) {
      console.error('Failed to initialize database for loading config:', error);
      this.configSubject.next(DEFAULT_MCP_CONFIG);
      return DEFAULT_MCP_CONFIG;
    }
  }
  
  /**
   * Save MCP configuration to IndexedDB
   */
  async saveConfiguration(config: McpConfiguration): Promise<void> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        try {
          console.log('Creating transaction for save...');
          const transaction = db.transaction([this.MCP_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.MCP_STORE_NAME);
          const request = store.put(config, this.CONFIG_KEY);
          
          // Listen to transaction complete event
          transaction.oncomplete = () => {
            this.configSubject.next(config);
            console.log('Transaction completed, MCP configuration saved:', config);
            resolve();
          };
          
          transaction.onerror = () => {
            console.error('Transaction error:', transaction.error);
            reject(transaction.error);
          };
          
          request.onsuccess = () => {
            console.log('Put request succeeded');
          };
          
          request.onerror = () => {
            console.error('Put request error:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('Exception saving configuration:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize database for saving config:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }
  
  /**
   * Clear MCP configuration
   */
  async clearConfiguration(): Promise<void> {
    try {
      const db = await this.initDB();
      
      return new Promise((resolve, reject) => {
        try {
          const transaction = db.transaction([this.MCP_STORE_NAME], 'readwrite');
          const store = transaction.objectStore(this.MCP_STORE_NAME);
          const request = store.delete(this.CONFIG_KEY);
          
          request.onsuccess = () => {
            this.configSubject.next(DEFAULT_MCP_CONFIG);
            console.log('Cleared MCP configuration');
            resolve();
          };
          
          request.onerror = () => {
            console.error('Error clearing configuration:', request.error);
            reject(request.error);
          };
        } catch (error) {
          console.error('Exception clearing configuration:', error);
          reject(error);
        }
      });
    } catch (error) {
      console.error('Failed to initialize database for clearing config:', error);
      throw error;
    }
  }
  
  /**
   * Export configuration as JSON string
   */
  exportConfiguration(): string {
    return JSON.stringify(this.configSubject.value, null, 2);
  }
  
  /**
   * Import configuration from JSON string
   */
  async importConfiguration(jsonString: string): Promise<void> {
    try {
      const config: McpConfiguration = JSON.parse(jsonString);
      
      // Validate configuration structure
      if (!config.mcpServers || typeof config.mcpServers !== 'object') {
        throw new Error('Invalid configuration format: missing mcpServers');
      }
      
      // Validate each server configuration
      for (const [name, serverConfig] of Object.entries(config.mcpServers)) {
        if (!serverConfig.command || !Array.isArray(serverConfig.args)) {
          throw new Error(`Invalid server configuration for ${name}: missing command or args`);
        }
      }
      
      await this.saveConfiguration(config);
    } catch (error) {
      console.error('Error importing configuration:', error);
      throw error;
    }
  }
}

// Made with Bob