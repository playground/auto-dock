import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MCPPrompt } from '../../../core/models/mcp-prompt.model';

@Component({
  selector: 'app-prompt-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './prompt-dialog.component.html',
  styleUrls: ['./prompt-dialog.component.scss']
})
export class PromptDialogComponent {
  @Input() prompt: MCPPrompt | null = null;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() submit = new EventEmitter<Record<string, string>>();

  promptArguments: Record<string, string> = {};

  ngOnChanges(): void {
    // Initialize arguments with empty strings when prompt changes
    if (this.prompt?.arguments) {
      this.promptArguments = {};
      this.prompt.arguments.forEach(arg => {
        this.promptArguments[arg.name] = '';
      });
    }
  }

  onCancel(): void {
    this.close.emit();
  }

  onSubmit(): void {
    if (this.isValid()) {
      this.submit.emit(this.promptArguments);
    }
  }

  isValid(): boolean {
    if (!this.prompt?.arguments) {
      return true;
    }

    // Check if all required arguments are filled
    return this.prompt.arguments
      .filter(arg => arg.required)
      .every(arg => this.promptArguments[arg.name]?.trim().length > 0);
  }

  onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.onCancel();
    }
  }
}

// Made with Bob
