import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

// Components
import { ButtonComponent } from './components/button/button.component';
import { LoadingSpinnerComponent } from './components/loading-spinner/loading-spinner.component';
import { MessageBubbleComponent } from './components/message-bubble/message-bubble.component';
import { ToolExecutionComponent } from './components/tool-execution/tool-execution.component';
import { McpServerMenuComponent } from './components/mcp-server-menu/mcp-server-menu.component';

// Pipes
import { MarkdownPipe } from './pipes/markdown.pipe';
import { TimeAgoPipe } from './pipes/time-ago.pipe';

// Directives
import { ClickOutsideDirective } from './directives/click-outside.directive';

@NgModule({
  declarations: [
    // Components
    ButtonComponent,
    LoadingSpinnerComponent,
    MessageBubbleComponent,
    ToolExecutionComponent,
    McpServerMenuComponent,
    
    // Pipes
    MarkdownPipe,
    TimeAgoPipe,
    
    // Directives
    ClickOutsideDirective
  ],
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule
  ],
  exports: [
    // Modules
    CommonModule,
    RouterModule,
    FormsModule,
    ReactiveFormsModule,
    
    // Components
    ButtonComponent,
    LoadingSpinnerComponent,
    MessageBubbleComponent,
    ToolExecutionComponent,
    McpServerMenuComponent,
    
    // Pipes
    MarkdownPipe,
    TimeAgoPipe,
    
    // Directives
    ClickOutsideDirective
  ]
})
export class SharedModule { }

// Made with Bob
