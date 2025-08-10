// lib/response-formatters/role-specific.ts
import { DoceboRole } from '../rbac/permissions';

export class RoleSpecificFormatter {
  
  formatResponse(data: any, intent: string, userRole: DoceboRole): string {
    switch (userRole) {
      case DoceboRole.SUPERADMIN:
        return this.formatSuperAdminResponse(data, intent);
        
      case DoceboRole.POWER_USER:
        return this.formatPowerUserResponse(data, intent);
        
      case DoceboRole.USER_MANAGER:
        return this.formatManagerResponse(data, intent);
        
      default:
        return this.formatBasicResponse(data, intent);
    }
  }
  
  private formatSuperAdminResponse(data: any, intent: string): string {
    if (data.error) {
      return `❌ **Error**: ${data.message || 'Unknown error occurred'}`;
    }
    
    switch (intent) {
      case 'course_search':
        if (!data.found) {
          return data.message || 'No courses found';
        }
        
        const courses = data.courses || [];
        const courseList = courses.map((course: any) => 
          `• **${course.name}** (ID: ${course.id})
    📊 Status: ${course.published ? '✅ Published' : '❌ Draft'}
    👥 Enrolled: ${course.enrolled_users} users
    🎯 Type: ${course.type}
    🔧 [Modify Settings] [View Analytics] [Manage Enrollments]`
        ).join('\n\n');
        
        return `🎯 **Course Search Results** (${courses.length} found)\n\n${courseList}\n\n💡 **Admin Actions Available**: Modify any course settings, view detailed analytics, manage all enrollments.`;
        
      case 'statistics':
        if (data.error) return data.message;
        
        return `📊 **System Statistics** (Super Admin View)
        
**Overview:**
- Total Completions: ${data.stats.total_completions}
- Overall Completion Rate: ${data.stats.completion_rate}%
- Active Learners: ${data.stats.active_learners}
- Courses in Progress: ${data.stats.courses_in_progress}

**Monthly Trend:**
${data.chartData.map((item: any) => `${item.month}: ${item.completions} completions`).join('\n')}

🔧 **Admin Actions**: [Export Full Report] [View User Details] [System Analytics] [Performance Metrics]`;
        
      default:
        return JSON.stringify(data, null, 2);
    }
  }
  
  private formatPowerUserResponse(data: any, intent: string): string {
    if (data.error) {
      return `❌ **Error**: ${data.message || 'Unknown error occurred'}`;
    }
    
    switch (intent) {
      case 'course_search':
        if (!data.found) {
          return data.message || 'No courses found';
        }
        
        const courses = data.courses || [];
        const courseList = courses.map((course: any) => 
          `• **${course.name}** (ID: ${course.id})
    📊 Status: ${course.published ? '✅ Published' : '❌ Draft'}
    👥 Enrolled: ${course.enrolled_users} users
    ⚙️ [Modify Course] [Enroll Users]`
        ).join('\n\n');
        
        return `🎯 **Course Search Results** (${courses.length} found)\n\n${courseList}\n\n💡 **Available Actions**: Modify course content, enroll users you manage.`;
        
      default:
        return JSON.stringify(data, null, 2);
    }
  }
  
  private formatManagerResponse(data: any, intent: string): string {
    if (data.error) {
      return `❌ **Access Restricted**: ${data.message || 'Contact your administrator for access.'}`;
    }
    
    switch (intent) {
      case 'statistics':
        return `📊 **Team Statistics** (Your Managed Users Only)
        
**Team Performance:**
- Team Completions: ${data.stats.total_completions}
- Team Completion Rate: ${data.stats.completion_rate}%
- Active Team Members: ${data.stats.active_learners}

📋 **Available Reports**: [Team Progress] [Individual Reports] [Export CSV]

ℹ️ **Note**: Statistics limited to users under your management.`;
        
      default:
        return `📊 **Manager View**: Limited data available. Contact administrator for full access.`;
    }
  }
  
  private formatBasicResponse(data: any, intent: string): string {
    return `ℹ️ **Limited Access**: Please contact your administrator for appropriate permissions.`;
  }
}
