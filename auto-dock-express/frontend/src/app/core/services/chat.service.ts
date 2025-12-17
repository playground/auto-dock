import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { MCPService } from './mcp.service';
import { MCPSettingsService } from './mcp-settings.service';
import { BackendAgentService } from './backend-agent.service';
import { IndexedDBService } from './indexed-db.service';

export interface ToolExecution {
  toolName: string;
  request: any;
  response: any;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export interface MessageVersion {
  id: string;
  content: string;
  timestamp: Date;
  toolExecutions?: ToolExecution[];
}

export interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'error';
  toolExecutions?: ToolExecution[];
  versions?: MessageVersion[];  // Track different versions of responses
  currentVersionIndex?: number;  // Which version is currently displayed
}

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private conversations = new BehaviorSubject<Conversation[]>([]);
  public conversations$ = this.conversations.asObservable();
  
  private currentConversation = new BehaviorSubject<Conversation | null>(null);
  public currentConversation$ = this.currentConversation.asObservable();
  
  private readonly CONVERSATIONS_KEY = 'bob_desktop_conversations';

  constructor(
    private http: HttpClient,
    private mcpService: MCPService,
    private mcpSettingsService: MCPSettingsService,
    private backendAgent: BackendAgentService,
    private indexedDB: IndexedDBService
  ) {
    this.loadConversationsWithMigration();
  }

  /**
   * Load conversations from IndexedDB, migrating from localStorage if needed
   */
  private loadConversationsWithMigration(): void {
    // First, try to load from IndexedDB
    this.indexedDB.get<Conversation[]>(this.CONVERSATIONS_KEY)
      .pipe(
        switchMap((conversations: Conversation[] | null) => {
          if (conversations && conversations.length > 0) {
            // Conversations found in IndexedDB
            console.log('Loaded conversations from IndexedDB');
            return of(conversations);
          } else {
            // No conversations in IndexedDB, try to migrate from localStorage
            console.log('No conversations in IndexedDB, checking localStorage for migration');
            return this.migrateConversationsFromLocalStorage();
          }
        }),
        catchError(error => {
          console.error('Error loading conversations:', error);
          // Try to migrate from localStorage as fallback
          return this.migrateConversationsFromLocalStorage();
        })
      )
      .subscribe((conversations: Conversation[]) => {
        // Convert string dates back to Date objects
        conversations.forEach(conv => {
          conv.createdAt = new Date(conv.createdAt);
          conv.updatedAt = new Date(conv.updatedAt);
          conv.messages.forEach(msg => {
            msg.timestamp = new Date(msg.timestamp);
            if (msg.versions) {
              msg.versions.forEach(version => {
                version.timestamp = new Date(version.timestamp);
              });
            }
          });
        });
        
        this.conversations.next(conversations);
        
        // Set the most recent conversation as current if available
        if (conversations.length > 0) {
          this.setCurrentConversation(conversations[0].id);
        }
      });
  }

  /**
   * Migrate conversations from localStorage to IndexedDB
   */
  private migrateConversationsFromLocalStorage(): Observable<Conversation[]> {
    console.log('Attempting to migrate conversations from localStorage');
    
    const storedConversations = localStorage.getItem(this.CONVERSATIONS_KEY);
    
    if (storedConversations) {
      try {
        const conversations: Conversation[] = JSON.parse(storedConversations);
        console.log(`Found ${conversations.length} conversations in localStorage, migrating to IndexedDB`);
        
        // Save to IndexedDB
        return this.indexedDB.set(this.CONVERSATIONS_KEY, conversations).pipe(
          map(() => {
            console.log('Successfully migrated conversations to IndexedDB');
            
            // Clean up localStorage after successful migration
            localStorage.removeItem(this.CONVERSATIONS_KEY);
            console.log('Cleaned up conversations from localStorage');
            
            return conversations;
          }),
          catchError(error => {
            console.error('Failed to migrate conversations to IndexedDB:', error);
            // Return the conversations anyway, even if migration failed
            return of(conversations);
          })
        );
      } catch (error) {
        console.error('Failed to parse stored conversations from localStorage:', error);
      }
    }
    
    console.log('No conversations found in localStorage');
    return of([]);
  }

  /**
   * Fix titles for conversations that have messages but still have default "New Conversation" title
   * This is a one-time migration helper for existing conversations
   */
  private fixConversationTitles(conversations: Conversation[]): void {
    let needsSave = false;
    
    conversations.forEach(conv => {
      // If conversation has messages but still has default title, update it
      if (conv.title === 'New Conversation' && conv.messages.length > 0) {
        // Find the first user message
        const firstUserMessage = conv.messages.find(msg => msg.role === 'user');
        if (firstUserMessage) {
          const newTitle = firstUserMessage.content.length > 30
            ? firstUserMessage.content.substring(0, 30) + '...'
            : firstUserMessage.content;
          
          console.log(`Fixing title for conversation ${conv.id}: "${newTitle}"`);
          conv.title = newTitle;
          needsSave = true;
        }
      }
    });
    
    // Save updated conversations if any titles were fixed
    if (needsSave) {
      this.conversations.next(conversations);
      this.saveConversationsToStorage();
      console.log('Fixed conversation titles and saved to IndexedDB');
    }
  }

  /**
   * Save conversations to IndexedDB
   */
  private saveConversationsToStorage(): void {
    this.indexedDB.set(this.CONVERSATIONS_KEY, this.conversations.value)
      .pipe(
        catchError(error => {
          console.error('Failed to save conversations to IndexedDB:', error);
          return of(undefined);
        })
      )
      .subscribe();
  }

  public get allConversations(): Conversation[] {
    return this.conversations.value;
  }

  public get current(): Conversation | null {
    return this.currentConversation.value;
  }

  createConversation(title: string = 'New Conversation'): Conversation {
    const now = new Date();
    const newConversation: Conversation = {
      id: this.generateId(),
      title,
      messages: [],
      createdAt: now,
      updatedAt: now
    };
    
    const updatedConversations = [newConversation, ...this.conversations.value];
    this.conversations.next(updatedConversations);
    this.currentConversation.next(newConversation);
    this.saveConversationsToStorage();
    
    return newConversation;
  }

  setCurrentConversation(conversationId: string): void {
    const conversation = this.conversations.value.find(c => c.id === conversationId);
    if (conversation) {
      this.currentConversation.next(conversation);
    }
  }

  updateConversation(conversationId: string, updates: Partial<Conversation>): void {
    const updatedConversations = this.conversations.value.map(conv => {
      if (conv.id === conversationId) {
        const updated = { 
          ...conv, 
          ...updates, 
          updatedAt: new Date() 
        };
        
        // If this is the current conversation, update that too
        if (this.currentConversation.value?.id === conversationId) {
          this.currentConversation.next(updated);
        }
        
        return updated;
      }
      return conv;
    });
    
    this.conversations.next(updatedConversations);
    this.saveConversationsToStorage();
  }

  deleteConversation(conversationId: string): void {
    const updatedConversations = this.conversations.value.filter(conv => conv.id !== conversationId);
    this.conversations.next(updatedConversations);
    
    // If we deleted the current conversation, set a new one
    if (this.currentConversation.value?.id === conversationId) {
      this.currentConversation.next(updatedConversations.length > 0 ? updatedConversations[0] : null);
    }
    
    this.saveConversationsToStorage();
  }

  /**
   * Filter out error messages from conversation history
   * IMPORTANT: This should ALWAYS keep user messages
   */
  private filterErrorMessages(messages: Message[]): Message[] {
    return messages.filter(msg => {
      // ALWAYS keep all user and system messages
      if (msg.role === 'user' || msg.role === 'system') {
        return true;
      }
      
      // For assistant messages, filter out error messages
      if (msg.role === 'assistant') {
        const isErrorMessage =
          msg.content.includes('Failed to parse') ||
          msg.content.includes('Error:') ||
          msg.content.includes('unexpected format') ||
          msg.content.includes('Failed to communicate with') ||
          msg.content.includes('All fallback endpoints failed') ||
          msg.content.includes('All endpoints failed');
        
        return !isErrorMessage;
      }
      
      return true; // Keep any other message types
    });
  }

  sendMessage(content: string): Observable<Message> {
    if (!this.currentConversation.value) {
      this.createConversation();
    }
    
    const conversationId = this.currentConversation.value!.id;
    
    // Get current conversation state
    let conversation = this.currentConversation.value!;
    
    const userMessage: Message = {
      id: this.generateId(),
      content,
      role: 'user',
      timestamp: new Date(),
      status: 'sending'
    };
    
    // Add user message to conversation (keep ALL messages, don't filter)
    const updatedMessages = [...conversation.messages, userMessage];
    this.updateConversation(conversationId, { messages: updatedMessages });
    
    // Update conversation title immediately if this is the first message
    if (conversation.title === 'New Conversation' && conversation.messages.length === 0) {
      const title = content.length > 30
        ? content.substring(0, 30) + '...'
        : content;
      this.updateConversation(conversationId, { title });
    }
    
    // Use backend agent for chat (with session-based credentials)
    return of(userMessage).pipe(
      tap(() => {
        // Get fresh conversation state
        conversation = this.currentConversation.value!;
        // Update message status to sent
        const updatedMessagesWithStatus = conversation.messages.map(msg =>
          msg.id === userMessage.id ? { ...msg, status: 'sent' as const } : msg
        );
        this.updateConversation(conversationId, { messages: updatedMessagesWithStatus });
      }),
      switchMap(() => {
        // Send message to backend agent
        return this.backendAgent.sendMessage(content, conversation.id).pipe(
          map(response => {
            // Convert tool executions from backend response
            const toolExecutions: ToolExecution[] | undefined = response.toolsUsed?.map(tool => ({
              toolName: tool.toolName,
              request: tool.input,
              response: tool.output,
              timestamp: new Date(),
              success: tool.success,
              error: tool.error
            }));

            // Convert backend response to Message format
            const assistantMessage: Message = {
              id: this.generateId(),
              content: response.message,
              role: 'assistant',
              timestamp: new Date(response.timestamp),
              toolExecutions
            };
            return assistantMessage;
          }),
          tap(assistantMessage => {
            // Get fresh conversation state
            conversation = this.currentConversation.value!;
            // Add assistant response to conversation
            const updatedMessagesWithResponse = [...conversation.messages, assistantMessage];
            this.updateConversation(conversationId, { messages: updatedMessagesWithResponse });
          }),
          catchError(error => {
            console.error('Error sending message to backend agent:', error);
            
            // Check if it's a 401 error (session expired)
            if (error.status === 401) {
              console.warn('Session expired. User will be redirected to settings by interceptor.');
            }
            
            // Get fresh conversation state
            conversation = this.currentConversation.value!;
            // Update message status to error
            const updatedMessages = conversation.messages.map(msg =>
              msg.id === userMessage.id ? { ...msg, status: 'error' as const } : msg
            );
            this.updateConversation(conversationId, { messages: updatedMessages });
            
            // Add error message to conversation
            const errorMessage: Message = {
              id: this.generateId(),
              content: error.status === 401
                ? 'Session expired. Please configure your credentials in Settings.'
                : `Error: ${error.error?.message || 'Failed to send message'}`,
              role: 'assistant',
              timestamp: new Date()
            };
            const updatedMessagesWithError = [...updatedMessages, errorMessage];
            this.updateConversation(conversationId, { messages: updatedMessagesWithError });
            
            throw error;
          })
        );
      })
    );
  }

  private generateAssistantResponse(userMessage: string): string {
    // Simple mock response generator
    const responses = [
      `I understand you're saying "${userMessage}". How can I help with that?`,
      `Thanks for your message. I'm MCP Orchestrator, an intelligent agent that orchestrates multiple MCP servers.`,
      `I'm processing your request: "${userMessage}". Is there anything specific you'd like to know?`,
      `That's an interesting point about "${userMessage}". Would you like me to elaborate on this topic?`,
      `I'm here to assist with your query about "${userMessage}". What additional information would be helpful?`
    ];
    
    return responses[Math.floor(Math.random() * responses.length)];
  }

  /**
   * Add a new version to an assistant message
   */
  addMessageVersion(conversationId: string, messageId: string, newVersion: MessageVersion): void {
    const conversation = this.conversations.value.find(c => c.id === conversationId);
    if (!conversation) return;

    const updatedMessages = conversation.messages.map(msg => {
      if (msg.id === messageId && msg.role === 'assistant') {
        const versions = msg.versions || [];
        const currentVersion: MessageVersion = {
          id: this.generateId(),
          content: msg.content,
          timestamp: msg.timestamp,
          toolExecutions: msg.toolExecutions
        };
        
        // If this is the first version, add the current content as version 0
        if (versions.length === 0) {
          versions.push(currentVersion);
        }
        
        // Add the new version
        versions.push(newVersion);
        
        return {
          ...msg,
          content: newVersion.content,
          toolExecutions: newVersion.toolExecutions,
          timestamp: newVersion.timestamp,
          versions,
          currentVersionIndex: versions.length - 1
        };
      }
      return msg;
    });

    this.updateConversation(conversationId, { messages: updatedMessages });
  }

  /**
   * Switch to a different version of a message
   */
  switchMessageVersion(conversationId: string, messageId: string, versionIndex: number): void {
    const conversation = this.conversations.value.find(c => c.id === conversationId);
    if (!conversation) return;

    const updatedMessages = conversation.messages.map(msg => {
      if (msg.id === messageId && msg.versions && msg.versions[versionIndex]) {
        const version = msg.versions[versionIndex];
        return {
          ...msg,
          content: version.content,
          toolExecutions: version.toolExecutions,
          timestamp: version.timestamp,
          currentVersionIndex: versionIndex
        };
      }
      return msg;
    });

    this.updateConversation(conversationId, { messages: updatedMessages });
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }
}

// Made with Bob
