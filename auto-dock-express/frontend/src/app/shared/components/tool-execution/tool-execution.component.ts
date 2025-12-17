import { Component, Input } from '@angular/core';
import { ToolExecution } from '../../../core/services/chat.service';

@Component({
  selector: 'app-tool-execution',
  templateUrl: './tool-execution.component.html',
  styleUrls: ['./tool-execution.component.scss']
})
export class ToolExecutionComponent {
  @Input() toolExecution!: ToolExecution;
  @Input() index: number = 0;
  
  isExpanded = false;

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  formatJson(obj: any): string {
    try {
      return JSON.stringify(obj, null, 2);
    } catch (e) {
      return String(obj);
    }
  }
}

// Made with Bob