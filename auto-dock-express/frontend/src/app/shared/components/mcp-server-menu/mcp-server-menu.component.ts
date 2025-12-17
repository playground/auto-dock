import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { McpDiscoveryService } from '../../../core/services/mcp-discovery.service';
import { McpServerStatus } from '../../../core/models/mcp-config.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-mcp-server-menu',
  templateUrl: './mcp-server-menu.component.html',
  styleUrls: ['./mcp-server-menu.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class McpServerMenuComponent implements OnInit, OnDestroy {
  isOpen = false;
  servers: McpServerStatus[] = [];
  expandedServers: Set<string> = new Set();
  isRefreshing = false;
  isLoading = false;
  
  private subscription?: Subscription;

  constructor(
    private mcpDiscoveryService: McpDiscoveryService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Subscribe to server status updates
    this.subscription = this.mcpDiscoveryService.serversStatus$.subscribe(servers => {
      this.servers = servers;
      this.isLoading = false;
      this.cdr.markForCheck();
    });
  }

  ngOnDestroy(): void {
    this.subscription?.unsubscribe();
  }

  /**
   * Toggle menu open/close
   */
  toggleMenu(): void {
    this.isOpen = !this.isOpen;
    
    // If opening the menu and no servers loaded yet, show loading state
    if (this.isOpen && this.servers.length === 0) {
      this.isLoading = true;
      // Trigger a refresh to load server status
      this.mcpDiscoveryService.manualRefresh().finally(() => {
        this.isLoading = false;
        this.cdr.markForCheck();
      });
    }
    
    this.cdr.markForCheck();
  }

  /**
   * Close menu
   */
  closeMenu(): void {
    this.isOpen = false;
    this.cdr.markForCheck();
  }

  /**
   * Toggle server expansion to show tools
   */
  toggleServerExpansion(serverName: string): void {
    if (this.expandedServers.has(serverName)) {
      this.expandedServers.delete(serverName);
    } else {
      this.expandedServers.add(serverName);
    }
    this.cdr.markForCheck();
  }

  /**
   * Check if server is expanded
   */
  isServerExpanded(serverName: string): boolean {
    return this.expandedServers.has(serverName);
  }

  /**
   * Navigate to settings
   */
  navigateToSettings(): void {
    this.closeMenu();
    // Navigation will be handled by parent component or router
    window.location.href = '/#/settings';
  }

  /**
   * Refresh server status
   */
  async refreshStatus(): Promise<void> {
    if (this.isRefreshing) return;
    
    this.isRefreshing = true;
    this.cdr.markForCheck();
    
    try {
      await this.mcpDiscoveryService.manualRefresh();
    } catch (error) {
      console.error('Error refreshing server status:', error);
    } finally {
      this.isRefreshing = false;
      this.cdr.markForCheck();
    }
  }

  /**
   * Get count of connected servers
   */
  get connectedServers(): number {
    return this.servers.filter(s => s.connected).length;
  }

  /**
   * Get total server count
   */
  get totalServers(): number {
    return this.servers.length;
  }

  /**
   * Get icon for connection status
   */
  getStatusIcon(connected: boolean): string {
    return connected ? '🟢' : '🔴';
  }

  /**
   * Get status text
   */
  getStatusText(connected: boolean): string {
    return connected ? 'Connected' : 'Disconnected';
  }
}

// Made with Bob
