# Angular 19 Migration Notes

## Current Status

The frontend is currently using **Angular 17** (pre-built files in `web/` directory) because Angular 19 requires code changes for compatibility.

## What's Set Up

✅ **Frontend source code** - Copied to `frontend/src/`  
✅ **Angular 19 dependencies** - Installed in `frontend/package.json`  
✅ **Build configuration** - Updated for Angular 19  
✅ **Working pre-built app** - Angular 17 build in `web/` directory  

## Migration Required

The Angular 17 code needs updates to work with Angular 19:

### 1. Module System Changes

Angular 19 has stricter module requirements. The current error:
```
Error: Can't be exported from this NgModule, as it must be imported first
```

This affects:
- `MarkdownPipe`
- `TimeAgoPipe`
- `ClickOutsideDirective`

### 2. Recommended Migration Path

**Option A: Migrate to Standalone Components (Recommended)**

Angular 19 encourages standalone components. Convert the app to use standalone components instead of NgModules:

```typescript
// Before (NgModule)
@NgModule({
  declarations: [MyComponent],
  imports: [CommonModule]
})

// After (Standalone)
@Component({
  standalone: true,
  imports: [CommonModule],
  ...
})
```

**Option B: Fix Module Imports**

Keep NgModules but fix the import/export structure to comply with Angular 19 requirements.

### 3. Steps to Migrate

1. **Update to Standalone Components:**
   ```bash
   cd frontend
   ng generate @angular/core:standalone
   ```

2. **Or manually update each component:**
   - Add `standalone: true` to component decorators
   - Move imports from NgModule to component
   - Remove NgModule declarations

3. **Update app.module.ts:**
   - Convert to standalone bootstrap
   - Update routing configuration

4. **Test the build:**
   ```bash
   npm run build
   ```

5. **Update documentation** once migration is complete

## Current Workaround

For now, the application uses the pre-built Angular 17 files which work perfectly. You can:

1. **Use the app immediately** - The Angular 17 build is fully functional
2. **Develop with Angular 17** - Keep using Angular 17 until ready to migrate
3. **Migrate when ready** - Follow the steps above when you have time

## Using the Current Setup

The app works out of the box:

```bash
# Start the server
npm run dev

# Access at http://localhost:8888
```

All features are available:
- Chat interface
- MCP integration
- Tool execution
- Settings management
- PWA support

## Future Work

When ready to migrate to Angular 19:

1. Follow Angular's official migration guide
2. Use the Angular CLI migration schematics
3. Test thoroughly
4. Update this document with the migration steps taken

## Resources

- [Angular 19 Migration Guide](https://angular.io/guide/update-to-latest-version)
- [Standalone Components Guide](https://angular.io/guide/standalone-components)
- [Angular CLI Schematics](https://angular.io/cli/generate)

---

Made with Bob 🤖