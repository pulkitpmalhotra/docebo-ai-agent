import { BaseAPI } from './BaseAPI';
import { Enrollment } from '../../../domain/entities/Enrollment';

export class EnrollmentsAPI extends BaseAPI {
  async getUserEnrollments(userId: number): Promise<Enrollment[]> {
    const response = await this.get(`/learn/v1/enrollments/users/${userId}`);
    return response.data.items;
  }

  async getCourseEnrollments(courseId: number): Promise<Enrollment[]> {
    const response = await this.get(`/learn/v1/enrollments/courses/${courseId}`);
    return response.data.items;
  }

  async enrollUser(userId: number, courseId: number): Promise<Enrollment> {
    const response = await this.post('/learn/v1/enrollments', {
      user_id: userId,
      course_id: courseId
    });
    return response.data;
  }

  // Add more enrollment-related methods as needed
}
