# Auto-Dock Express Frontend

This document describes the Angular frontend setup for Auto-Dock Express.

## Architecture

The project uses a separated frontend/backend architecture:

```
auto-dock-express/
├── frontend/           # Angular 19 source code
│   ├── src/           # Angular components, services, etc.
│   ├── angular.json   # Angular configuration
│   ├── package.json   # Frontend dependencies
│   └── ...
├── web/               # Built Angular app (served by Express)
│   ├── index.html
│   ├── *.js
│   └── assets/
└── src/               # Backend TypeScript code
    ├── server.ts
    └── ...
```

## Features

- **Angular 19** - Latest Angular version with improved performance
- **PWA Support** - Progressive Web App with service workers
- **Tailwind CSS** - Utility-first CSS framework
- **TypeScript** - Type-safe development
- **Responsive Design** - Mobile-friendly interface
- **MCP Integration** - Full Model Context Protocol support
- **Chat Interface** - Interactive AI agent chat
- **Settings Management** - Configure MCP servers and credentials

## Setup

### First Time Setup

1. **Install frontend dependencies:**
   ```bash
   npm run frontend:install
   ```

2. **Build the frontend:**
   ```bash
   npm run frontend:build
   ```

3. **Start the backend server:**
   ```bash
   npm run dev
   ```

4. **Access the application:**
   Open your browser to `http://localhost:8888`

## Development

### Available Scripts

From the **root directory**:

- `npm run frontend:install` - Install Angular dependencies
- `npm run frontend:build` - Build for production (outputs to `web/`)
- `npm run frontend:build:dev` - Build for development
- `npm run frontend:start` - Start Angular dev server (port 4200)
- `npm run frontend:watch` - Watch mode for development

From the **frontend directory** (`cd frontend`):

- `npm start` - Start Angular dev server
- `npm run build` - Build for production
- `npm run build:dev` - Build for development
- `npm test` - Run tests
- `npm run lint` - Lint code

### Development Workflow

**Option 1: Use built files (recommended for backend development)**
1. Build frontend once: `npm run frontend:build`
2. Start backend: `npm run dev`
3. Backend serves built files from `web/`
4. Access at `http://localhost:8888`

**Option 2: Angular dev server (recommended for frontend development)**
1. Start Angular dev server: `npm run frontend:start`
2. Start backend: `npm run dev`
3. Access Angular at `http://localhost:4200`
4. Backend API at `http://localhost:8888`

**Option 3: Watch mode**
1. Start watch mode: `npm run frontend:watch`
2. Start backend: `npm run dev`
3. Changes auto-rebuild to `web/`
4. Refresh browser to see changes

## Building for Production

```bash
# Build frontend
npm run frontend:build

# Build backend
npm run build

# Start production server
npm start
```

The production build:
- Minifies and optimizes code
- Enables AOT compilation
- Generates service worker for PWA
- Outputs to `web/` directory

## Project Structure

### Frontend (`frontend/src/`)

```
src/
├── app/
│   ├── core/              # Core services and models
│   │   ├── services/      # Angular services
│   │   ├── models/        # TypeScript interfaces
│   │   └── interceptors/  # HTTP interceptors
│   ├── pages/             # Page components
│   │   ├── chat/          # Chat interface
│   │   ├── home/          # Home page
│   │   └── settings/      # Settings page
│   ├── shared/            # Shared components
│   │   ├── components/    # Reusable components
│   │   ├── pipes/         # Custom pipes
│   │   └── directives/    # Custom directives
│   └── app.module.ts      # Root module
├── assets/                # Static assets
├── styles/                # Global styles
└── environments/          # Environment configs
```

### Key Components

- **Chat Component** - Main chat interface with AI agent
- **Settings Component** - MCP server configuration
- **MCP Service** - Handles MCP protocol communication
- **Backend Agent Service** - Communicates with Express backend
- **Auth Service** - Manages user credentials

## API Integration

The frontend communicates with the backend via REST API:

- `POST /api/auth/credentials` - Set AI credentials
- `POST /api/agent/query` - Send chat messages
- `GET /api/agent/conversation/:id` - Get conversation history
- `GET /api/health` - Health check
- `POST /mcp` - MCP protocol endpoint

## Environment Configuration

Environment files are in `frontend/src/environments/`:

- `environment.ts` - Development config
- `environment.prod.ts` - Production config

Configure API endpoints and other settings here.

## Troubleshooting

### Build Errors

**Error: Cannot find module '@angular/...'**
```bash
cd frontend && npm install
```

**Error: Output path not found**
- Check `angular.json` has `outputPath: "../web"`
- Ensure `web/` directory exists

### Runtime Errors

**404 on page refresh**
- Backend must serve `index.html` for all routes (already configured)

**CORS errors**
- Check backend CORS configuration in `src/server.ts`
- Ensure `CORS_ORIGIN` env variable is set correctly

**API connection failed**
- Verify backend is running on correct port
- Check `.env` file for PORT configuration

## Upgrading Angular

To upgrade to a newer Angular version:

```bash
cd frontend
ng update @angular/core @angular/cli
npm install
npm run build
```

## PWA Features

The app includes Progressive Web App capabilities:

- **Offline Support** - Service worker caches assets
- **Install Prompt** - Can be installed on desktop/mobile
- **App Manifest** - Defines app metadata
- **Icons** - Multiple sizes for different devices

Configure PWA in `ngsw-config.json`.

## Contributing

When adding new features:

1. Create components in appropriate directory
2. Add services to `core/services/`
3. Update routing in `app-routing.module.ts`
4. Add tests for new functionality
5. Build and test before committing

## License

Same as Auto-Dock Express main project.

---

Made with Bob 🤖