import { EnrollmentsAPI } from '../docebo/EnrollmentsAPI';

export class EnrollmentService {
  private enrollmentsAPI: EnrollmentsAPI;

  constructor() {
    this.enrollmentsAPI = new EnrollmentsAPI();
  }

  async enrollUser(userId: number, courseId: number) {
    return this.enrollmentsAPI.enrollUser(userId, courseId);
  }

  async getEnrollmentStatus(userId: number, courseId: number) {
    return this.enrollmentsAPI.getEnrollmentStatus(userId, courseId);
  }

  async unenrollUser(userId: number, courseId: number) {
    return this.enrollmentsAPI.unenrollUser(userId, courseId);
  }
}
