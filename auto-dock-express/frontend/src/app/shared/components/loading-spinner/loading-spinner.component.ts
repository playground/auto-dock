import { Component, Input, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-loading-spinner',
  templateUrl: './loading-spinner.component.html',
  styleUrls: ['./loading-spinner.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoadingSpinnerComponent {
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() color: 'primary' | 'white' | 'gray' = 'primary';
  
  get sizeClass(): string {
    const sizes = {
      sm: 'h-4 w-4',
      md: 'h-8 w-8',
      lg: 'h-12 w-12'
    };
    
    return sizes[this.size];
  }
  
  get colorClass(): string {
    const colors = {
      primary: 'text-primary-600 dark:text-primary-400',
      white: 'text-white',
      gray: 'text-gray-600 dark:text-gray-400'
    };
    
    return colors[this.color];
  }
}

// Made with Bob
