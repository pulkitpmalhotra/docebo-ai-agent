// lib/docebo-enhanced.ts - Production version
import { DoceboClient } from './docebo';

interface SearchResult {
  found: boolean;
  data?: any;
  message?: string;
  error?: string;
  suggestions?: any[];
}

export class EnhancedDoceboClient extends DoceboClient {
  
  // User Management with real API
  async getUserStatus(identifier: string, type: 'email' | 'username' | 'id'): Promise<SearchResult> {
    try {
      console.log(`🔍 Searching for user: ${identifier} (${type})`);
      
      if (type === 'id') {
        const user = await this.getUserById(parseInt(identifier));
        return {
          found: !!user,
          data: user
        };
      } else if (type === 'email') {
        const user = await this.getUserByEmail(identifier);
        return {
          found: !!user,
          data: user
        };
      } else {
        // For username, search all users
        const users = await this.getUsers({ search: identifier });
        const foundUser = users.data?.find((user: any) => user.username === identifier);
        return {
          found: !!foundUser,
          data: foundUser
        };
      }
    } catch (error) {
      console.error('❌ Error getting user status:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Enhanced course search with real API
  async searchCourses(query: string, type: 'id' | 'title'): Promise<SearchResult> {
    try {
      console.log(`🔍 Searching for course: ${query} (${type})`);
      
      if (type === 'id') {
        const courseId = parseInt(query);
        if (isNaN(courseId)) {
          return {
            found: false,
            message: `"${query}" is not a valid course ID. Please provide a numeric ID.`
          };
        }
        
        const course = await this.getCourseById(courseId);
        return {
          found: !!course,
          data: course ? [course] : []
        };
      } else {
        // Search by title
        const courses = await this.searchCoursesByTitle(query);
        
        if (!courses.data || courses.data.length === 0) {
          // Try to find similar courses
          const allCourses = await this.getCourses({ limit: 100 });
          const suggestions = this.findSimilarCourses(query, allCourses.data || []);
          
          if (suggestions.length > 0) {
            return {
              found: false,
              message: `No exact match found for "${query}". Here are similar courses:`,
              suggestions: suggestions
            };
          }
          
          return {
            found: false,
            message: `No courses found matching "${query}". Try using the exact course name or ID.`
          };
        }
        
        return {
          found: true,
          data: courses.data
        };
      }
    } catch (error) {
      console.error('❌ Error searching courses:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Learning Plans search
  async searchLearningPlans(query: string, type: 'id' | 'title'): Promise<SearchResult> {
    try {
      console.log(`🔍 Searching for learning plan: ${query} (${type})`);
      
      if (type === 'id') {
        const planId = parseInt(query);
        if (isNaN(planId)) {
          return {
            found: false,
            message: `"${query}" is not a valid learning plan ID. Please provide a numeric ID.`
          };
        }
        
        const plan = await this.getLearningPlanById(planId);
        return {
          found: !!plan,
          data: plan ? [plan] : []
        };
      } else {
        const plans = await this.getLearningPlans({ search: query });
        
        if (!plans.data || plans.data.length === 0) {
          return {
            found: false,
            message: `No learning plans found matching "${query}".`
          };
        }
        
        return {
          found: true,
          data: plans.data
        };
      }
    } catch (error) {
      console.error('❌ Error searching learning plans:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Enhanced enrollment with real API
  async enrollUserInCourse(userIdentifier: string, courseIdentifier: string, dry_run: boolean = true): Promise<any> {
    try {
      console.log(`📝 Enrolling user ${userIdentifier} in course ${courseIdentifier}`);
      
      // Find user
      let user;
      if (userIdentifier.includes('@')) {
        user = await this.getUserByEmail(userIdentifier);
      } else if (/^\d+$/.test(userIdentifier)) {
        user = await this.getUserById(parseInt(userIdentifier));
      } else {
        const users = await this.getUsers({ search: userIdentifier });
        user = users.data?.[0];
      }
      
      if (!user) {
        throw new Error(`User "${userIdentifier}" not found`);
      }
      
      // Find course
      let course;
      if (/^\d+$/.test(courseIdentifier)) {
        course = await this.getCourseById(parseInt(courseIdentifier));
      } else {
        const courses = await this.searchCoursesByTitle(courseIdentifier);
        course = courses.data?.[0];
      }
      
      if (!course) {
        throw new Error(`Course "${courseIdentifier}" not found`);
      }
      
      // Perform enrollment
      return await this.enrollUser(user.id, course.id, dry_run);
    } catch (error) {
      console.error('❌ Enrollment failed:', error);
      throw new Error(`Enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Group enrollment
  async enrollGroupInCourse(groupIdentifier: string, courseIdentifier: string, dry_run: boolean = true): Promise<any> {
    try {
      console.log(`📝 Enrolling group ${groupIdentifier} in course ${courseIdentifier}`);
      
      // Find group
      let group;
      if (/^\d+$/.test(groupIdentifier)) {
        group = await this.getGroupById(parseInt(groupIdentifier));
      } else {
        const groups = await this.getGroups({ search: groupIdentifier });
        group = groups.data?.[0];
      }
      
      if (!group) {
        throw new Error(`Group "${groupIdentifier}" not found`);
      }
      
      // Find course
      let course;
      if (/^\d+$/.test(courseIdentifier)) {
        course = await this.getCourseById(parseInt(courseIdentifier));
      } else {
        const courses = await this.searchCoursesByTitle(courseIdentifier);
        course = courses.data?.[0];
      }
      
      if (!course) {
        throw new Error(`Course "${courseIdentifier}" not found`);
      }
      
      if (dry_run) {
        return {
          message: `Dry run: Group "${group.name}" (${group.id}) would be enrolled in course "${course.name}" (${course.id})`,
          dry_run: true,
          group_id: group.id,
          course_id: course.id
        };
      }
      
      // Get group members and enroll them
      const members = await this.getGroupMembers(group.id);
      const enrollments = [];
      
      for (const member of members.data || []) {
        try {
          const enrollment = await this.enrollUser(member.id, course.id, false);
          enrollments.push(enrollment);
        } catch (error) {
          console.error(`Failed to enroll user ${member.id}:`, error);
        }
      }
      
      return {
        message: `Group "${group.name}" enrolled in course "${course.name}"`,
        group_id: group.id,
        course_id: course.id,
        enrolled_users: enrollments.length,
        total_members: members.data?.length || 0
      };
      
    } catch (error) {
      console.error('❌ Group enrollment failed:', error);
      throw new Error(`Group enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Helper method for course similarity
  private findSimilarCourses(query: string, allCourses: any[]): any[] {
    const queryLower = query.toLowerCase();
    return allCourses
      .filter(course => {
        const nameLower = course.name.toLowerCase();
        return nameLower.includes(queryLower) || 
               this.calculateSimilarity(queryLower, nameLower) > 0.6;
      })
      .slice(0, 3);
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1, 
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
