// lib/docebo-enhanced.ts - Replace entire file with this fixed version:

import { DoceboClient } from './docebo';

interface SearchResult {
  found: boolean;
  data?: any;
  message?: string;
  error?: string;
  suggestions?: any[];
}

export class EnhancedDoceboClient extends DoceboClient {
  
  // User Management
  async getUserStatus(identifier: string, type: 'email' | 'username' | 'id'): Promise<SearchResult> {
    try {
      if (type === 'id') {
        const users = await this.getUsers({ search: identifier });
        const foundUser = users.data?.find((user: any) => user.id.toString() === identifier);
        return {
          found: !!foundUser,
          data: foundUser
        };
      } else {
        const users = await this.getUsers({ search: identifier });
        const foundUser = users.data?.find((user: any) => 
          (type === 'email' && user.email === identifier) ||
          (type === 'username' && user.username === identifier)
        );
        return {
          found: !!foundUser,
          data: foundUser
        };
      }
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Course Management with suggestions
  async searchCourses(query: string, type: 'id' | 'title'): Promise<SearchResult> {
    try {
      const courses = await this.getCourses({ search: query });
      
      if (!courses.data || courses.data.length === 0) {
        // Try to find similar courses for suggestions
        const allCourses = await this.getCourses({});
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
          message: `No courses found for "${query}"`
        };
      }
      
      return {
        found: true,
        data: courses.data
      };
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Helper method to find similar courses
  private findSimilarCourses(query: string, allCourses: any[]): any[] {
    const queryLower = query.toLowerCase();
    const suggestions = allCourses.filter(course => {
      const nameLower = course.name.toLowerCase();
      const categoryLower = (course.category || '').toLowerCase();
      
      // Simple fuzzy matching
      return nameLower.includes(queryLower) || 
             categoryLower.includes(queryLower) ||
             this.calculateSimilarity(queryLower, nameLower) > 0.5;
    }).slice(0, 3); // Limit to 3 suggestions
    
    return suggestions;
  }
  
  // Simple similarity calculation
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  // Levenshtein distance for fuzzy matching
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  // Use public methods instead of private apiCall
  async getCourseDetails(courseId: number): Promise<any> {
    try {
      // Use the public getCourses method to find the course by ID
      const courses = await this.getCourses({});
      const course = courses.data?.find((c: any) => c.id === courseId);
      
      if (!course) {
        throw new Error(`Course with ID ${courseId} not found`);
      }
      
      return course;
    } catch (error) {
      throw new Error(`Could not get course details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getCourseStatus(courseId: number): Promise<any> {
    try {
      const course = await this.getCourseDetails(courseId);
      return {
        id: courseId,
        published: course.status === 'published',
        status: course.status || 'published'
      };
    } catch (error) {
      return {
        id: courseId,
        published: false,
        status: 'unknown',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Learning Plans
  async searchLearningPlans(query: string, type: 'id' | 'title'): Promise<SearchResult> {
    try {
      // Mock implementation for now since we don't have learning plans in mock data
      return {
        found: false,
        message: `Learning plan search for "${query}" - Feature coming soon`
      };
    } catch (error) {
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  // Enhanced enrollment methods using public APIs
  async enrollUserInCourse(userIdentifier: string, courseIdentifier: string): Promise<any> {
    try {
      // Find user first
      const users = await this.getUsers({ search: userIdentifier });
      if (!users.data || users.data.length === 0) {
        throw new Error(`User "${userIdentifier}" not found`);
      }
      
      // Find course
      const courses = await this.getCourses({ search: courseIdentifier });
      if (!courses.data || courses.data.length === 0) {
        throw new Error(`Course "${courseIdentifier}" not found`);
      }
      
      const user = users.data[0];
      const course = courses.data[0];
      
      // Use the public enrollUser method
      return await this.enrollUser(user.id, course.id, false);
    } catch (error) {
      throw new Error(`Enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Group enrollment
  async enrollGroupInCourse(groupIdentifier: string, courseIdentifier: string): Promise<any> {
    try {
      // For now, return a mock response since we don't have group management in mock
      return {
        message: `Mock: Group "${groupIdentifier}" would be enrolled in course "${courseIdentifier}"`,
        group_identifier: groupIdentifier,
        course_identifier: courseIdentifier,
        mode: 'mock'
      };
    } catch (error) {
      throw new Error(`Group enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  // Analytics methods
  async getCourseCompletionStats(courseId: number): Promise<any> {
    try {
      // Mock implementation with realistic data
      return {
        course_id: courseId,
        total_enrolled: 45,
        completed: 34,
        in_progress: 8,
        not_started: 3,
        completion_rate: 75.6,
        average_score: 82.3
      };
    } catch (error) {
      throw new Error(`Could not get completion stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getLearningPlanCompletionStats(planId: number): Promise<any> {
    try {
      // Mock implementation
      return {
        plan_id: planId,
        total_enrolled: 23,
        completed: 18,
        in_progress: 4,
        not_started: 1,
        completion_rate: 78.3
      };
    } catch (error) {
      throw new Error(`Could not get learning plan stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
