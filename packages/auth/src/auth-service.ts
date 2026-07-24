import type { AuthProvider } from './auth-provider.js';
import type { RequestContext } from './types.js';

// The single object product code uses for auth. It never imports a provider SDK;
// it only delegates to the configured AuthProvider.
export class AuthService {
  constructor(private readonly provider: AuthProvider) {}

  get providerName() {
    return this.provider.name;
  }

  getSession(ctx: RequestContext) {
    return this.provider.getSession(ctx);
  }

  requireSession(ctx: RequestContext) {
    return this.provider.requireSession(ctx);
  }

  signOut(ctx: RequestContext) {
    return this.provider.signOut(ctx);
  }

  async updateUserName(
    appUserId: string,
    name: { firstName: string; lastName: string }
  ): Promise<void> {
    await this.provider.updateUserName?.(appUserId, name);
  }

  async getUserMetadata(appUserId: string): Promise<Record<string, unknown>> {
    return (await this.provider.getUserMetadata?.(appUserId)) ?? {};
  }

  async setUserRole(appUserId: string, role: string): Promise<void> {
    await this.provider.setUserRole?.(appUserId, role);
  }

  async deleteUser(appUserId: string): Promise<void> {
    await this.provider.deleteUser?.(appUserId);
  }
}
