import type { AuthService } from './auth-service.js';

// Process-wide AuthService handle. The host app creates the service once at
// startup (createAuthProvider + new AuthService) and registers it here so
// middleware modules can reach it without import cycles or per-file wiring.

let service: AuthService | null = null;

export function setAuthService(instance: AuthService | null): void {
  service = instance;
}

export function getAuthService(): AuthService | null {
  return service;
}
