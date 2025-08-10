// lib/rbac/permissions.ts
export enum DoceboRole {
  SUPERADMIN = 'superadmin',
  POWER_USER = 'power_user', 
  USER_MANAGER = 'user_manager',
  USER = 'user'
}

// Define permission strings as a union type
export type Permission = 
  | 'user.search' 
  | 'course.search' 
  | 'course.modify' 
  | 'enroll.all' 
  | 'enroll.managed'
  | 'analytics.all' 
  | 'analytics.managed' 
  | 'notifications.create' 
  | 'settings.modify'
  | 'user.search.managed';

export const PERMISSIONS: Record<DoceboRole, Permission[]> = {
  [DoceboRole.SUPERADMIN]: [
    'user.search', 
    'course.search', 
    'course.modify', 
    'enroll.all', 
    'analytics.all', 
    'notifications.create',
    'analytics.managed',
    'settings.modify'
  ],
  [DoceboRole.POWER_USER]: [
    'user.search', 
    'course.search', 
    'course.modify', 
    'enroll.managed',
    'analytics.managed'
  ],
  [DoceboRole.USER_MANAGER]: [
    'analytics.managed', 
    'user.search.managed'
  ],
  [DoceboRole.USER]: []
};
