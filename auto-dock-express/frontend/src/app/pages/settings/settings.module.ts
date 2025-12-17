import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';


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
    imports: [
    RouterModule.forChild(routes),
    SettingsComponent,
    MCPServerSettingsComponent,
    McpConfigEditorComponent
]
})
export class SettingsModule { }

// Made with Bob
