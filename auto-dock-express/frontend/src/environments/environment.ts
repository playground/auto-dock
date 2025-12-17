// This file can be replaced during build by using the `fileReplacements` array.
// `ng build` replaces `environment.ts` with `environment.prod.ts`.

export const environment = {
  production: false,
  apiUrl: 'http://localhost:3000/api',
  backendUrl: 'http://localhost:3100/api',
  // Dynamic backend URL that uses the current window port if available
  getBackendUrl: (): string => {
    if (typeof window !== 'undefined' && window.location) {
      const currentPort = window.location.port;
      const protocol = window.location.protocol;
      const hostname = window.location.hostname || 'localhost';
      
      // If running on a custom port (like 3102), use that port for backend
      // If running on default Angular dev port (4200), use default backend port (3100)
      const backendPort = currentPort && currentPort !== '4200' ? currentPort : '3100';
      
      return `${protocol}//${hostname}:${backendPort}/api`;
    }
    return environment.backendUrl;
  }
};

// Made with Bob
