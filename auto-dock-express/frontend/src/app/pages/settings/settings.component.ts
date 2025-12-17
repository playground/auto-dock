import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService, Theme } from '../../core/services/theme.service';
import { McpConfigEditorComponent } from './mcp-config-editor/mcp-config-editor.component';
import { MCPServerSettingsComponent } from './mcp-server-settings/mcp-server-settings.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    McpConfigEditorComponent,
    MCPServerSettingsComponent
  ],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SettingsComponent implements OnInit, OnDestroy {
  settingsForm: FormGroup;
  themes: {value: Theme, label: string}[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System Default' }
  ];
  
  redirectReason: string | null = null;
  showRedirectMessage = false;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private themeService: ThemeService,
    private cdr: ChangeDetectorRef,
    private route: ActivatedRoute
  ) {
    this.settingsForm = this.fb.group({
      theme: [this.themeService.currentTheme],
      name: [''],
      email: [{value: '', disabled: true}]
    });
  }

  ngOnInit(): void {
    // Check if user was redirected from chat page
    this.subscriptions.push(
      this.route.queryParams.subscribe(params => {
        this.redirectReason = params['reason'];
        if (this.redirectReason) {
          this.showRedirectMessage = true;
          // Auto-hide message after 10 seconds
          setTimeout(() => {
            this.showRedirectMessage = false;
            this.cdr.markForCheck();
          }, 10000);
        }
        this.cdr.markForCheck();
      })
    );
    
    // Subscribe to theme changes
    this.subscriptions.push(
      this.themeService.theme$.subscribe(theme => {
        this.settingsForm.get('theme')?.setValue(theme);
        this.cdr.markForCheck();
      })
    );
    
    // Load user data if logged in
    if (this.authService.isLoggedIn) {
      const user = this.authService.currentUser;
      if (user) {
        this.settingsForm.patchValue({
          name: user.name,
          email: user.email
        });
      }
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
  
  onThemeChange(): void {
    const theme = this.settingsForm.get('theme')?.value as Theme;
    this.themeService.setTheme(theme);
  }
  
  saveProfile(): void {
    if (this.settingsForm.invalid) {
      return;
    }
    
    const userData = {
      name: this.settingsForm.get('name')?.value
    };
    
    this.authService.updateProfile(userData).subscribe({
      next: () => {
        // Show success message or notification
      },
      error: () => {
        // Show error message
      }
    });
  }
  
  logout(): void {
    this.authService.logout();
    // Redirect to home page
    window.location.href = '/';
  }
  
  getRedirectMessage(): string {
    switch (this.redirectReason) {
      case 'no-mcp-servers':
        return 'Please configure at least one MCP server to use the chat feature.';
      case 'all-servers-disconnected':
        return 'All MCP servers are disconnected. Please check your server configurations and ensure at least one server is connected.';
      case 'session_expired':
        return 'Authentication needed. Please provide AI provider credentials below.';
      case 'access_denied':
        return 'Access denied. Please verify your AI provider credentials below.';
      default:
        return '';
    }
  }

  dismissRedirectMessage(): void {
    this.showRedirectMessage = false;
    this.cdr.markForCheck();
  }
}

// Made with Bob
