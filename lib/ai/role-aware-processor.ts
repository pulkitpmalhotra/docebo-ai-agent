// lib/ai/role-aware-processor.ts
import { processUserQuery } from '../gemini-ai';
import { DoceboRole } from '../rbac/permissions';

export class RoleAwareAIProcessor {
  
  async processQuery(query: string, userRole: DoceboRole, userPermissions: string[]) {
    try {
      // Use existing AI processor but add role awareness
      const basicIntent = await processUserQuery(query);
      
      // Enhanced intent classification for role-specific features
      const enhancedIntent = this.enhanceIntentForRole(basicIntent, query, userRole);
      
      // Check permissions
      if (!this.hasPermission(enhancedIntent.intent, userPermissions)) {
        return {
          intent: 'permission_denied',
          message: `Your role (${userRole}) doesn't have permission for: ${enhancedIntent.intent}. Required permissions: ${this.getRequiredPermissions(enhancedIntent.intent).join(', ')}`
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
    
    // Check for enhanced intents
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
    
    if (queryLower.includes('stat') || queryLower.includes('completion') || queryLower.includes('report')) {
      return {
        intent: 'statistics_request',
        entities: { type: 'completion', scope: userRole === DoceboRole.USER_MANAGER ? 'managed' : 'all' }
      };
    }
    
    // Return enhanced version of basic intent
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
    
    // Extract user ID if present
    const idMatch = query.match(/\buser\s+(?:id\s+)?(\d+)\b/i);
    if (idMatch) {
      return { identifier: idMatch[1], type: 'id' };
    }
    
    // Extract username
    const usernameMatch = query.match(/\buser\s+(\w+)\b/i);
    if (usernameMatch) {
      return { identifier: usernameMatch[1], type: 'username' };
    }
    
    return { identifier: 'unknown', type: 'email' };
  }
  
  private extractCourseIdentifier(query: string) {
    // Extract course ID
    const idMatch = query.match(/\bcourse\s+(?:id\s+)?(\d+)\b/i);
    if (idMatch) {
      return { query: idMatch[1], type: 'id' };
    }
    
    // Extract course name in quotes
    const nameMatch = query.match(/['"]([^'"]+)['"]/);
    if (nameMatch) {
      return { query: nameMatch[1], type: 'title' };
    }
    
    // Extract course name after "course"
    const courseMatch = query.match(/\bcourse\s+(.+?)(?:\s|$)/i);
    if (courseMatch) {
      return { query: courseMatch[1].trim(), type: 'title' };
    }
    
    return { query: 'unknown', type: 'title' };
  }
  
  private extractEnrollmentEntities(query: string) {
    const emailMatch = query.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    const courseMatch = query.match(/\bin\s+(.+?)(?:\s|$)/i);
    
    return {
      user: emailMatch ? emailMatch[0] : 'unknown',
      course: courseMatch ? courseMatch[1].trim() : 'unknown'
    };
  }
  
  private hasPermission(intent: string, userPermissions: string[]): boolean {
    const requiredPermissions = this.getRequiredPermissions(intent);
    return requiredPermissions.some(permission => userPermissions.includes(permission));
  }
  
  private getRequiredPermissions(intent: string): string[] {
    const permissionMap: { [key: string]: string[] } = {
      'user_status_check': ['user.search'],
      'course_search': ['course.search'],
      'enrollment_request': ['enroll.all', 'enroll.managed'],
      'statistics_request': ['analytics.all', 'analytics.managed'],
      'settings_modification': ['settings.modify'],
      'notification_creation': ['notifications.create']
    };
    
    return permissionMap[intent] || [];
  }
}
