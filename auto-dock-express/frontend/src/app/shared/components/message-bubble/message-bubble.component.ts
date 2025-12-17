import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { Message } from '../../../core/services/chat.service';

@Component({
  selector: 'app-message-bubble',
  templateUrl: './message-bubble.component.html',
  styleUrls: ['./message-bubble.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MessageBubbleComponent {
  @Input() message!: Message;
  @Output() onEdit = new EventEmitter<{ messageId: string; newContent: string }>();
  @Output() onRerun = new EventEmitter<string>();
  @Output() onVersionChange = new EventEmitter<{ messageId: string; versionIndex: number }>();
  @Output() onRegenerate = new EventEmitter<void>();
  
  isEditing = false;
  editedContent = '';
  
  constructor(private cdr: ChangeDetectorRef) {}
  
  get hasMultipleVersions(): boolean {
    return this.message.versions ? this.message.versions.length > 1 : false;
  }
  
  get totalVersions(): number {
    return this.message.versions ? this.message.versions.length : 1;
  }
  
  get currentVersionDisplay(): number {
    return (this.message.currentVersionIndex ?? 0) + 1;
  }
  
  get canGoPrevious(): boolean {
    return (this.message.currentVersionIndex ?? 0) > 0;
  }
  
  get canGoNext(): boolean {
    const currentIndex = this.message.currentVersionIndex ?? 0;
    const totalVersions = this.message.versions?.length ?? 1;
    return currentIndex < totalVersions - 1;
  }
  
  get isUser(): boolean {
    return this.message.role === 'user';
  }
  
  get isAssistant(): boolean {
    return this.message.role === 'assistant';
  }
  
  get statusText(): string {
    switch (this.message.status) {
      case 'sending':
        return 'Sending...';
      case 'error':
        return 'Error sending message';
      default:
        return '';
    }
  }
  
  get formattedTime(): string {
    if (!this.message.timestamp) {
      return '';
    }
    
    return new Date(this.message.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }
  
  startEditing(): void {
    this.isEditing = true;
    this.editedContent = this.message.content;
    this.cdr.markForCheck();
  }
  
  cancelEditing(): void {
    this.isEditing = false;
    this.editedContent = '';
    this.cdr.markForCheck();
  }
  
  saveEdit(): void {
    if (this.editedContent.trim() && this.editedContent !== this.message.content) {
      this.onEdit.emit({
        messageId: this.message.id,
        newContent: this.editedContent.trim()
      });
    }
    this.isEditing = false;
    this.cdr.markForCheck();
  }
  
  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault();
      this.saveEdit();
    }
  }
  
  rerunMessage(): void {
    this.onRerun.emit(this.message.content);
  }
  
  previousVersion(): void {
    if (this.canGoPrevious) {
      const newIndex = (this.message.currentVersionIndex ?? 0) - 1;
      this.onVersionChange.emit({
        messageId: this.message.id,
        versionIndex: newIndex
      });
    }
  }
  
  nextVersion(): void {
    if (this.canGoNext) {
      const newIndex = (this.message.currentVersionIndex ?? 0) + 1;
      this.onVersionChange.emit({
        messageId: this.message.id,
        versionIndex: newIndex
      });
    }
  }
  
  regenerateResponse(): void {
    this.onRegenerate.emit();
  }
}

// Made with Bob
