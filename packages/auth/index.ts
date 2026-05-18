import { User, UserRole } from '@kongila/shared-types';

export function hasRole(user: User | null, role: UserRole): boolean {
  if (!user) return false;
  return user.role === role;
}

export function isAdmin(user: User | null): boolean {
  return hasRole(user, 'admin');
}

export function isClient(user: User | null): boolean {
  return hasRole(user, 'client');
}

export function isTalent(user: User | null): boolean {
  return hasRole(user, 'talent');
}

export function canAccessPlatform(user: User | null, platform: 'kongila' | 'remotan' | 'admin'): boolean {
  if (!user) return false;
  return user.platform_access.includes(platform);
}

// Active Mock Session
export function getMockUserSession(role: UserRole): User {
  switch (role) {
    case 'admin':
      return {
        id: 'user_admin_1',
        name: 'Sarah Connor',
        email: 'sarah.connor@kongila.com',
        role: 'admin',
        platform_access: ['kongila', 'remotan', 'admin']
      };
    case 'client':
      return {
        id: 'user_client_1',
        name: 'Alex Mercer (Vanguard Corp)',
        email: 'alex.mercer@vanguard.com',
        role: 'client',
        platform_access: ['kongila', 'remotan'],
        organizationId: 'org_vanguard'
      };
    case 'talent':
    default:
      return {
        id: 'talent_chidi', // Binds to the preseeded talent record
        name: 'Chidi Anya',
        email: 'chidi.anya@kongila.dev',
        role: 'talent',
        platform_access: ['kongila', 'remotan']
      };
  }
}
