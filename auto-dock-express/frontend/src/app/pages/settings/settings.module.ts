import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { SharedModule } from '../../shared/shared.module';
import { SettingsComponent } from './settings.component';
import { MCPServerSettingsComponent } from './mcp-server-settings/mcp-server-settings.component';
import { McpConfigEditorComponent } from './mcp-config-editor/mcp-config-editor.component';

const routes: Routes = [
  {
    path: '',
    component: SettingsComponent
  }
];

@NgModule({
  declarations: [
    SettingsComponent,
    MCPServerSettingsComponent,
    McpConfigEditorComponent
  ],
  imports: [
    SharedModule,
    RouterModule.forChild(routes)
  ]
})
export class SettingsModule { }

// Made with Bob
