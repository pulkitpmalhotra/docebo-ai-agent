// lib/docebo-enhanced.ts
export class EnhancedDoceboClient extends DoceboClient {
  
  // User Management
  async getUserStatus(identifier: string, type: 'email' | 'username' | 'id') {
    const endpoint = type === 'id' 
      ? `/manage/v1/users/${identifier}`
      : `/manage/v1/users?${type}=${identifier}`;
    return this.apiCall(endpoint);
  }
  
  // Course Management
  async searchCourses(query: string, type: 'id' | 'title') {
    const params = type === 'id' 
      ? `id=${query}`
      : `search=${encodeURIComponent(query)}`;
    return this.apiCall(`/learn/v1/courses?${params}`);
  }
  
  async getCourseDetails(courseId: number) {
    return this.apiCall(`/learn/v1/courses/${courseId}`);
  }
  
  async getCourseStatus(courseId: number) {
    const course = await this.getCourseDetails(courseId);
    return {
      id: courseId,
      published: course.status === 'published',
      status: course.status
    };
  }
  
  // Learning Plans
  async searchLearningPlans(query: string, type: 'id' | 'title') {
    const params = type === 'id' 
      ? `id=${query}`
      : `search=${encodeURIComponent(query)}`;
    return this.apiCall(`/learn/v1/learning-plans?${params}`);
  }
  
  async getLearningPlanDetails(planId: number) {
    return this.apiCall(`/learn/v1/learning-plans/${planId}`);
  }
  
  // Enrollments
  async enrollUserInCourse(userIdentifier: string, courseIdentifier: string) {
    const user = await this.findUser(userIdentifier);
    const course = await this.findCourse(courseIdentifier);
    
    return this.apiCall('/learn/v1/enrollments', 'POST', {
      user_id: user.id,
      course_id: course.id
    });
  }
  
  async enrollGroupInCourse(groupIdentifier: string, courseIdentifier: string) {
    const group = await this.findGroup(groupIdentifier);
    const course = await this.findCourse(courseIdentifier);
    
    return this.apiCall('/learn/v1/enrollments/bulk', 'POST', {
      group_id: group.id,
      course_id: course.id
    });
  }
  
  // Analytics
  async getCourseCompletionStats(courseId: number) {
    return this.apiCall(`/analytics/v1/courses/${courseId}/completions`);
  }
  
  async getLearningPlanCompletionStats(planId: number) {
    return this.apiCall(`/analytics/v1/learning-plans/${planId}/completions`);
  }
  
  // Helper methods
  private async findUser(identifier: string) {
    // Smart search: try email, then username, then ID
  }
  
  private async findCourse(identifier: string) {
    // Smart search: try ID first, then title search with fuzzy matching
  }
  
  private async suggestSimilarNames(query: string, type: 'course' | 'learning_plan') {
    // Implement fuzzy search for suggestions
  }
}
