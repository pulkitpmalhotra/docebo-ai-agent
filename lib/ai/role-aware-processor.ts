// lib/ai/role-aware-processor.ts
import { processUserQuery } from '../gemini-ai';
import { DoceboRole, Permission } from '../rbac/permissions';

export class RoleAwareAIProcessor {
  
  async processQuery(query: string, userRole: DoceboRole, userPermissions: Permission[]) {
    try {
      const basicIntent = await processUserQuery(query);
      const enhancedIntent = this.enhanceIntentForRole(basicIntent, query, userRole);
      
      if (!this.hasPermission(enhancedIntent.intent, userPermissions)) {
        return {
          intent: 'permission_denied',
          message: `Your role (${userRole}) doesn't have permission for: ${enhancedIntent.intent}`
        };
      }
      
      return enhancedIntent;
    } catch (error) {
      return {
        intent: 'error',
        message: `Error processing query: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
  
  private enhanceIntentForRole(basicIntent: any, query: string, userRole: DoceboRole) {
    const queryLower = query.toLowerCase();
    
    if (queryLower.includes('status') && queryLower.includes('user')) {
      return {
        intent: 'user_status_check',
        entities: this.extractUserIdentifier(query)
      };
    }
    
    if (queryLower.includes('find') && queryLower.includes('course')) {
      return {
        intent: 'course_search',
        entities: this.extractCourseIdentifier(query)
      };
    }
    
    if (queryLower.includes('enroll')) {
      return {
        intent: 'enrollment_request',
        entities: this.extractEnrollmentEntities(query)
      };
    }
    
    if (queryLower.includes('stat') || queryLower.includes('completion')) {
      return {
        intent: 'statistics_request',
        entities: { type: 'completion' }
      };
    }
    
    return {
      ...basicIntent,
      enhanced: true
    };
  }
  
  private extractUserIdentifier(query: string) {
    const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    if (emailMatch) {
      return { identifier: emailMatch[0], type: 'email' };
    }
    return { identifier: 'john.smith@company.com', type: 'email' };
  }
  
  private extractCourseIdentifier(query: string) {
    const nameMatch = query.match(/['"]([^'"]+)['"]/);
    if (nameMatch) {
      return { query: nameMatch[1], type: 'title' };
    }
    
    const courseMatch = query.match(/\bcourse\s+(.+?)(?:\s|$)/i);
    if (courseMatch) {
      return { query: courseMatch[1].trim(), type: 'title' };
    }
    
    return { query: 'Python', type: 'title' };
  }
  
  private extractEnrollmentEntities(query: string) {
    const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const courseMatch = query.match(/\bin\s+(.+?)(?:\s|$)/i);
    
    return {
      user: emailMatch ? emailMatch[0] : 'user@company.com',
      course: courseMatch ? courseMatch[1].trim() : 'course'
    };
  }
  
  private hasPermission(intent: string, userPermissions: Permission[]): boolean {
    const requiredPermissions = this.getRequiredPermissions(intent);
    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
  
  private getRequiredPermissions(intent: string): Permission[] {
    const permissionMap: { [key: string]: Permission[] } = {
      'user_status_check': ['user.search'],
      'course_search': ['course.search'],
      'enrollment_request': ['enroll.all', 'enroll.managed'],
      'statistics_request': ['analytics.all', 'analytics.managed']
    };
    
    return permissionMap[intent] || [];
  }
}
