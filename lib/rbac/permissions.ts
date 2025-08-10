// lib/rbac/permissions.ts
export enum DoceboRole {
  SUPERADMIN = 'superadmin',
  POWER_USER = 'power_user', 
  USER_MANAGER = 'user_manager',
  USER = 'user'
}

export const PERMISSIONS = {
  [DoceboRole.SUPERADMIN]: [
    'user.search', 'course.search', 'course.modify', 'enroll.all', 
    'analytics.all', 'notifications.create'
  ],
  [DoceboRole.POWER_USER]: [
    'user.search', 'course.search', 'course.modify', 'enroll.managed',
    'analytics.managed'
  ],
  [DoceboRole.USER_MANAGER]: [
    'analytics.managed', 'user.search.managed'
  ],
  [DoceboRole.USER]: []
};
