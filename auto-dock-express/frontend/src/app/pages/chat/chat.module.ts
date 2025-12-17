import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';


import { ChatComponent } from './chat.component';
import { PromptDialogComponent } from '../../shared/components/prompt-dialog/prompt-dialog.component';

const routes: Routes = [
  {
    path: '',
    component: ChatComponent
  }
];

@NgModule({
    imports: [
    RouterModule.forChild(routes),
    PromptDialogComponent,
    ChatComponent
]
})
export class ChatModule { }

// Made with Bob
