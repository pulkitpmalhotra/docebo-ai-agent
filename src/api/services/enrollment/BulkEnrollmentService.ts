import { EnrollmentService } from './EnrollmentService';

export class BulkEnrollmentService {
  private enrollmentService: EnrollmentService;

  constructor() {
    this.enrollmentService = new EnrollmentService();
  }

  async enrollUsersInCourse(userIds: number[], courseId: number) {
    const enrollmentPromises = userIds.map(userId =>
      this.enrollmentService.enrollUserInCourse(userId, courseId)
    );

    return Promise.all(enrollmentPromises);
  }

  // Add more bulk enrollment-related methods as needed
}
