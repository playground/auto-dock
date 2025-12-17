import { NgModule, Optional, SkipSelf } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';

// Services
import { AuthService } from './services/auth.service';
import { ChatService } from './services/chat.service';
import { ThemeService } from './services/theme.service';
import { IndexedDBService } from './services/indexed-db.service';
import { MCPSettingsService } from './services/mcp-settings.service';
import { MCPService } from './services/mcp.service';
import { BackendAgentService } from './services/backend-agent.service';

// Interceptors
import { AuthInterceptor } from './interceptors/auth.interceptor';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    HttpClientModule
  ],
  providers: [
    AuthService,
    ChatService,
    ThemeService,
    IndexedDBService,
    MCPSettingsService,
    MCPService,
    BackendAgentService,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ]
})
export class CoreModule {
  constructor(@Optional() @SkipSelf() parentModule: CoreModule) {
    if (parentModule) {
      throw new Error('CoreModule is already loaded. Import it in the AppModule only.');
    }
  }
}

// Made with Bob
