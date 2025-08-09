// Mock data that simulates real Docebo responses
const mockUsers = [
  { id: 1, email: 'john.smith@company.com', firstname: 'John', lastname: 'Smith', department: 'Marketing' },
  { id: 2, email: 'jane.doe@company.com', firstname: 'Jane', lastname: 'Doe', department: 'Sales' },
  { id: 3, email: 'mike.wilson@company.com', firstname: 'Mike', lastname: 'Wilson', department: 'IT' },
  { id: 4, email: 'sarah.johnson@company.com', firstname: 'Sarah', lastname: 'Johnson', department: 'HR' },
  { id: 5, email: 'david.brown@company.com', firstname: 'David', lastname: 'Brown', department: 'Finance' },
  { id: 6, email: 'john.davis@company.com', firstname: 'John', lastname: 'Davis', department: 'Operations' },
  { id: 7, email: 'emily.chen@company.com', firstname: 'Emily', lastname: 'Chen', department: 'Marketing' },
];

const mockCourses = [
  { id: 101, name: 'Python Fundamentals', course_type: 'elearning', enrolled_users: 24, category: 'Programming' },
  { id: 102, name: 'Advanced Python Programming', course_type: 'elearning', enrolled_users: 15, category: 'Programming' },
  { id: 103, name: 'Python for Data Analysis', course_type: 'webinar', enrolled_users: 18, category: 'Data Science' },
  { id: 104, name: 'Advanced Excel Training', course_type: 'webinar', enrolled_users: 32, category: 'Office Skills' },
  { id: 105, name: 'Digital Marketing Basics', course_type: 'elearning', enrolled_users: 28, category: 'Marketing' },
  { id: 106, name: 'JavaScript for Beginners', course_type: 'elearning', enrolled_users: 22, category: 'Programming' },
  { id: 107, name: 'Sales Techniques', course_type: 'classroom', enrolled_users: 12, category: 'Sales' },
  { id: 108, name: 'Leadership Development', course_type: 'blended', enrolled_users: 19, category: 'Management' },
];

const mockEnrollments = [
  { id: 1, user_id: 1, course_id: 101, course_name: 'Python Fundamentals', status: 'in_progress', completion_percentage: 75 },
  { id: 2, user_id: 1, course_id: 104, course_name: 'Advanced Excel Training', status: 'completed', completion_percentage: 100 },
  { id: 3, user_id: 2, course_id: 105, course_name: 'Digital Marketing Basics', status: 'in_progress', completion_percentage: 45 },
  { id: 4, user_id: 2, course_id: 106, course_name: 'JavaScript for Beginners', status: 'not_started', completion_percentage: 0 },
  { id: 5, user_id: 3, course_id: 101, course_name: 'Python Fundamentals', status: 'completed', completion_percentage: 100 },
  { id: 6, user_id: 4, course_id: 108, course_name: 'Leadership Development', status: 'in_progress', completion_percentage: 60 },
];

export class MockDoceboClient {
  constructor() {
    console.log('🎭 Using Mock Docebo Client (Development Mode)');
  }

  // Simulate API delay for realism
  private async delay(ms: number = 300) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getUsers(params: { limit?: number; search?: string } = {}) {
    await this.delay();
    
    let filteredUsers = mockUsers;
    
    if (params.search && params.search.trim() !== '' && params.search !== 'all') {
      const searchTerm = params.search.toLowerCase();
      filteredUsers = mockUsers.filter(user => 
        user.firstname.toLowerCase().includes(searchTerm) ||
        user.lastname.toLowerCase().includes(searchTerm) ||
        user.email.toLowerCase().includes(searchTerm) ||
        user.department.toLowerCase().includes(searchTerm)
      );
    }
    
    if (params.limit) {
      filteredUsers = filteredUsers.slice(0, params.limit);
    }
    
    return {
      data: filteredUsers,
      success: true,
      has_more_data: filteredUsers.length === params.limit
    };
  }

  async getCourses(params: { limit?: number; search?: string } = {}) {
    await this.delay();
    
    let filteredCourses = mockCourses;
    
    if (params.search && params.search.trim() !== '' && params.search !== 'all') {
      const searchTerm = params.search.toLowerCase();
      filteredCourses = mockCourses.filter(course => 
        course.name.toLowerCase().includes(searchTerm) ||
        course.course_type.toLowerCase().includes(searchTerm) ||
        course.category.toLowerCase().includes(searchTerm)
      );
    }
    
    if (params.limit) {
      filteredCourses = filteredCourses.slice(0, params.limit);
    }
    
    return {
      data: filteredCourses,
      success: true,
      has_more_data: filteredCourses.length === params.limit
    };
  }

  async getEnrollments(userId: number) {
    await this.delay();
    
    const userEnrollments = mockEnrollments.filter(enrollment => enrollment.user_id === userId);
    
    return {
      data: userEnrollments,
      success: true
    };
  }

  async healthCheck() {
    await this.delay(100);
    return { 
      status: 'healthy', 
      timestamp: new Date(),
      mode: 'mock',
      message: 'Mock Docebo client is working perfectly'
    };
  }

  async enrollUser(userId: number, courseId: number, dry_run: boolean = true) {
    await this.delay();
    
    if (dry_run) {
      return { 
        message: 'Mock: Enrollment would be successful', 
        dry_run: true,
        user_id: userId,
        course_id: courseId,
        mode: 'mock'
      };
    }
    
    return {
      message: 'Mock: User enrolled successfully',
      enrollment_id: Math.floor(Math.random() * 1000),
      user_id: userId,
      course_id: courseId,
      mode: 'mock'
    };
  }
}
