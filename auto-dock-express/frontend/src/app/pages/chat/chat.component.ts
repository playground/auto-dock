import { Component, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectionStrategy, ChangeDetectorRef, HostListener } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService, Conversation, Message } from '../../core/services/chat.service';
import { McpDiscoveryService } from '../../core/services/mcp-discovery.service';
import { IndexedDBService } from '../../core/services/indexed-db.service';
import { BackendAgentService } from '../../core/services/backend-agent.service';
import { MCPPrompt } from '../../core/models/mcp-prompt.model';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ChatComponent implements OnInit, OnDestroy {
  @ViewChild('messageContainer') messageContainer!: ElementRef;
  @ViewChild('promptDropdown') promptDropdown!: ElementRef;
  
  conversations: Conversation[] = [];
  currentConversation: Conversation | null = null;
  messageForm: FormGroup;
  sending = false;
  sidebarOpen = true;
  mcpInitialized = false;
  
  // Prompts
  availablePrompts: MCPPrompt[] = [];
  selectedPrompt: MCPPrompt | null = null;
  showPromptDialog = false;
  loadingPrompts = false;
  showPromptDropdown = false;
  
  private subscriptions: Subscription[] = [];
  
  constructor(
    private chatService: ChatService,
    private fb: FormBuilder,
    private cdr: ChangeDetectorRef,
    private mcpDiscoveryService: McpDiscoveryService,
    private router: Router,
    private indexedDBService: IndexedDBService,
    private backendAgentService: BackendAgentService
  ) {
    this.messageForm = this.fb.group({
      message: ['', [Validators.required]]
    });
  }

  ngOnInit(): void {
    // Load sidebar state from localStorage
    const savedState = localStorage.getItem('bob_sidebar_open');
    if (savedState !== null) {
      this.sidebarOpen = JSON.parse(savedState);
    }
    
    // Subscribe to MCP initialization status
    this.subscriptions.push(
      this.mcpDiscoveryService.initialized$.subscribe(initialized => {
        this.mcpInitialized = initialized;
        
        // Check MCP server status after initialization
        if (initialized) {
          this.checkMcpServersAndRedirect();
        }
        
        this.cdr.markForCheck();
        
        // Load prompts after MCP initialization
        if (initialized) {
          this.loadPrompts();
        }
      })
    );
    
    // Subscribe to conversations
    this.subscriptions.push(
      this.chatService.conversations$.subscribe(conversations => {
        this.conversations = conversations;
        this.cdr.markForCheck();
        
        // Don't auto-create conversations here - let the user create them manually
        // This prevents overwriting conversations that are being loaded from IndexedDB
      })
    );
    
    // Subscribe to current conversation
    this.subscriptions.push(
      this.chatService.currentConversation$.subscribe(conversation => {
        this.currentConversation = conversation;
        this.cdr.markForCheck();
        
        // Scroll to bottom when messages change
        setTimeout(() => this.scrollToBottom(), 0);
      })
    );
  }

  /**
   * Check if MCP servers are configured in IndexedDB.
   * Redirect to settings if no servers are configured.
   */
  private async checkMcpServersAndRedirect(): Promise<void> {
    try {
      // Load configuration from IndexedDB
      const config = await this.indexedDBService.loadConfiguration();
      
      // Check if any servers are configured in the mcpServers object
      if (!config || !config.mcpServers || Object.keys(config.mcpServers).length === 0) {
        console.warn('No MCP servers configured in IndexedDB. Redirecting to settings...');
        this.router.navigate(['/settings'], {
          queryParams: { reason: 'no-mcp-servers' }
        });
        return;
      }
      
      console.log(`Found ${Object.keys(config.mcpServers).length} MCP server(s) configured`);
      // Note: We no longer redirect if servers are disconnected.
      // Users can still use the chat interface and will see connection status in the UI.
    } catch (error) {
      console.error('Error checking MCP configuration:', error);
      // Don't redirect on error - let user access the chat
    }
  }

  /**
   * Get conversations to display in sidebar
   * Shows conversations with messages, plus the current active conversation (even if empty)
   */
  get conversationsWithMessages(): Conversation[] {
    return this.conversations.filter(conv =>
      conv.messages.length > 0 || conv.id === this.currentConversation?.id
    );
  }

  ngOnDestroy(): void {
    // Unsubscribe from all subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  /**
   * Close dropdown when clicking outside
   */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.showPromptDropdown && this.promptDropdown) {
      const clickedInside = this.promptDropdown.nativeElement.contains(event.target);
      if (!clickedInside) {
        this.closePromptDropdown();
      }
    }
  }
  
  createNewConversation(): void {
    this.chatService.createConversation();
  }
  
  selectConversation(conversationId: string): void {
    this.chatService.setCurrentConversation(conversationId);
  }
  
  deleteConversation(conversationId: string, event: MouseEvent): void {
    event.stopPropagation();
    this.chatService.deleteConversation(conversationId);
  }
  
  sendMessage(): void {
    if (this.messageForm.invalid || this.sending) {
      return;
    }
    
    const message = this.messageForm.value.message.trim();
    if (!message) {
      return;
    }
    
    this.sending = true;
    this.messageForm.get('message')?.disable();
    
    this.chatService.sendMessage(message).subscribe({
      next: () => {
        this.messageForm.reset();
        this.sending = false;
        this.messageForm.get('message')?.enable();
        this.cdr.markForCheck();
      },
      error: () => {
        this.sending = false;
        this.messageForm.get('message')?.enable();
        this.cdr.markForCheck();
      }
    });
  }
  
  handleEdit(event: { messageId: string; newContent: string }): void {
    if (!this.currentConversation) return;
    
    // Find the assistant message that follows this user message
    const messages = this.currentConversation.messages;
    const userMsgIndex = messages.findIndex(m => m.id === event.messageId);
    const assistantMsg = messages[userMsgIndex + 1];
    
    // Send the edited message
    this.sending = true;
    this.cdr.markForCheck();
    
    this.chatService.sendMessage(event.newContent).subscribe({
      next: (response) => {
        // If there's an assistant message following, add this as a new version
        if (assistantMsg && assistantMsg.role === 'assistant') {
          this.chatService.addMessageVersion(
            this.currentConversation!.id,
            assistantMsg.id,
            {
              id: response.id,
              content: response.content,
              timestamp: response.timestamp,
              toolExecutions: response.toolExecutions
            }
          );
        }
        this.sending = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sending = false;
        this.cdr.markForCheck();
      }
    });
  }
  
  handleRerun(content: string): void {
    if (!this.currentConversation) return;
    
    // Find the last assistant message
    const messages = this.currentConversation.messages;
    const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
    
    // Rerun the message with the same content
    this.sending = true;
    this.cdr.markForCheck();
    
    this.chatService.sendMessage(content).subscribe({
      next: (response) => {
        // Add this as a new version to the last assistant message
        if (lastAssistantMsg) {
          this.chatService.addMessageVersion(
            this.currentConversation!.id,
            lastAssistantMsg.id,
            {
              id: response.id,
              content: response.content,
              timestamp: response.timestamp,
              toolExecutions: response.toolExecutions
            }
          );
        }
        this.sending = false;
        this.cdr.markForCheck();
      },
      error: () => {
        this.sending = false;
        this.cdr.markForCheck();
      }
    });
  }
  
  handleVersionChange(event: { messageId: string; versionIndex: number }): void {
    if (!this.currentConversation) return;
    
    this.chatService.switchMessageVersion(
      this.currentConversation.id,
      event.messageId,
      event.versionIndex
    );
    this.cdr.markForCheck();
  }
  
  handleRegenerate(message: Message): void {
    if (!this.currentConversation) return;
    
    // Find the user message that precedes this assistant message
    const messages = this.currentConversation.messages;
    const assistantMsgIndex = messages.findIndex(m => m.id === message.id);
    const userMsg = messages[assistantMsgIndex - 1];
    
    if (userMsg && userMsg.role === 'user') {
      this.handleRerun(userMsg.content);
    }
  }
  
  toggleSidebar(): void {
    this.sidebarOpen = !this.sidebarOpen;
    // Save preference to localStorage
    localStorage.setItem('bob_sidebar_open', JSON.stringify(this.sidebarOpen));
  }
  
  private scrollToBottom(): void {
    if (this.messageContainer) {
      const element = this.messageContainer.nativeElement;
      element.scrollTop = element.scrollHeight;
    }
  }
  
  /**
   * Load available prompts from MCP servers
   */
  loadPrompts(): void {
    this.loadingPrompts = true;
    this.backendAgentService.getPrompts().subscribe({
      next: (response) => {
        this.availablePrompts = response.prompts;
        this.loadingPrompts = false;
        this.cdr.markForCheck();
      },
      error: (error) => {
        console.error('Error loading prompts:', error);
        this.loadingPrompts = false;
        this.cdr.markForCheck();
      }
    });
  }
  
  /**
   * Toggle prompt dropdown
   */
  togglePromptDropdown(): void {
    this.showPromptDropdown = !this.showPromptDropdown;
    this.cdr.markForCheck();
  }

  /**
   * Close prompt dropdown
   */
  closePromptDropdown(): void {
    this.showPromptDropdown = false;
    this.cdr.markForCheck();
  }

  /**
   * Open prompt dialog for a selected prompt
   */
  openPromptDialog(prompt: MCPPrompt): void {
    this.selectedPrompt = prompt;
    this.showPromptDialog = true;
    this.showPromptDropdown = false; // Close dropdown when opening dialog
    this.cdr.markForCheck();
  }
  
  /**
   * Close prompt dialog
   */
  closePromptDialog(): void {
    this.showPromptDialog = false;
    this.selectedPrompt = null;
    this.cdr.markForCheck();
  }
  
  /**
   * Handle prompt submission
   */
  handlePromptSubmit(args: Record<string, string>): void {
    if (!this.selectedPrompt) return;
    
    this.sending = true;
    this.backendAgentService.getPromptTemplate({
      server: this.selectedPrompt.server,
      promptName: this.selectedPrompt.name,
      arguments: args
    }).subscribe({
      next: (promptResult) => {
        // Extract text from prompt messages and send as a message
        const promptText = promptResult.messages
          .map(msg => msg.content.text || '')
          .join('\n\n');
        
        if (promptText) {
          this.chatService.sendMessage(promptText).subscribe({
            next: () => {
              this.sending = false;
              this.closePromptDialog();
              this.cdr.markForCheck();
            },
            error: () => {
              this.sending = false;
              this.cdr.markForCheck();
            }
          });
        } else {
          this.sending = false;
          this.closePromptDialog();
          this.cdr.markForCheck();
        }
      },
      error: (error) => {
        console.error('Error getting prompt template:', error);
        this.sending = false;
        this.cdr.markForCheck();
      }
    });
  }
}

// Made with Bob
