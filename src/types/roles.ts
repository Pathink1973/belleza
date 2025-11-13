export const USER_ROLES = {
  SUPER_ADMIN: 'super_admin',
  PROFESSIONAL: 'professional',
  CLIENT: 'client'
} as const;

export type UserRole = typeof USER_ROLES[keyof typeof USER_ROLES];

export const isValidRole = (role: string): role is UserRole => {
  return Object.values(USER_ROLES).includes(role as UserRole);
};

export const isSuperAdmin = (role: string): boolean => {
  return role === USER_ROLES.SUPER_ADMIN;
};

export const isProfessional = (role: string): boolean => {
  return role === USER_ROLES.PROFESSIONAL;
};

export const isClient = (role: string): boolean => {
  return role === USER_ROLES.CLIENT;
};
