import { BaseAPI } from './BaseAPI';
import { Course } from '../../../domain/entities/Course';

export class CoursesAPI extends BaseAPI {
  async getCourse(id: number): Promise<Course> {
    const response = await this.get(`/learn/v1/courses/${id}`);
    return response.data;
  }

  async searchCourses(query: string): Promise<Course[]> {
    const response = await this.get('/learn/v1/courses', { params: { search_text: query } });
    return response.data.items;
  }

  // Add more course-related methods as needed
}
