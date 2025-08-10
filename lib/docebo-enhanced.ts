// lib/docebo-enhanced.ts
import { DoceboClient } from './docebo';

export class EnhancedDoceboClient extends DoceboClient {
  
  // User Management
  async getUserStatus(identifier: string, type: 'email' | 'username' | 'id') {
    try {
      if (type === 'id') {
        const users = await this.getUsers({ search: identifier });
        return {
          found: users.data && users.data.length > 0,
          data: users.data?.[0]
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
  
  // Course Management
  async searchCourses(query: string, type: 'id' | 'title') {
    try {
      const courses = await this.getCourses({ search: query });
      
      if (!courses.data || courses.data.length === 0) {
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
  
  async getCourseDetails(courseId: number) {
    try {
      return await this.apiCall(`/learn/v1/courses/${courseId}`);
    } catch (error) {
      throw new Error(`Could not get course details: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  async getCourseStatus(courseId: number) {
    try {
      const course = await this.getCourseDetails(courseId);
      return {
        id: courseId,
        published: course.status === 'published',
        status: course.status
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
  async searchLearningPlans(query: string, type: 'id' | 'title') {
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
  
  // Enhanced enrollment methods
  async enrollUserInCourse(userIdentifier: string, courseIdentifier: string) {
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
      
      return await this.enrollUser(user.id, course.id, false);
    } catch (error) {
      throw new Error(`Enrollment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
