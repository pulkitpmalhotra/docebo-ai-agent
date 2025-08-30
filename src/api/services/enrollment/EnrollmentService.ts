import { EnrollmentsAPI } from '../docebo/EnrollmentsAPI';
import { UsersAPI } from '../docebo/UsersAPI';
import { CoursesAPI } from '../docebo/CoursesAPI';

export class EnrollmentService {
  private enrollmentsAPI: EnrollmentsAPI;
  private usersAPI: UsersAPI;
  private coursesAPI: CoursesAPI;

  constructor() {
    this.enrollmentsAPI = new EnrollmentsAPI();
    this.usersAPI = new UsersAPI();
    this.coursesAPI = new CoursesAPI();
  }

  async enrollUserInCourse(userId: number, courseId: number) {
    const user = await this.usersAPI.getUser(userId);
    const course = await this.coursesAPI.getCourse(courseId);

    if (!user || !course) {
      throw new Error('Invalid user or course');
    }

    return this.enrollmentsAPI.enrollUser(userId, courseId);
  }

  async getUserEnrollments(userId: number) {
    const user = await this.usersAPI.getUser(userId);

    if (!user) {
      throw new Error('Invalid user');
    }

    return this.enrollmentsAPI.getUserEnrollments(userId);
  }

  async getCourseEnrollments(courseId: number) {
    const course = await this.coursesAPI.getCourse(courseId);

    if (!course) {
      throw new Error('Invalid course');
    }

    return this.enrollmentsAPI.getCourseEnrollments(courseId);
  }

  // Add more enrollment-related methods as needed
}
