import { EnrollmentService } from './EnrollmentService';

export class BulkEnrollmentService {
  private enrollmentService: EnrollmentService;

  constructor() {
    this.enrollmentService = new EnrollmentService();
  }

  async enrollUsersInCourse(userIds: number[], courseId: number) {
    const enrollmentPromises = userIds.map(userId =>
      this.enrollmentService.enrollUser(userId, courseId)
    );

    return Promise.all(enrollmentPromises);
  }

  async unenrollUsersFromCourse(userIds: number[], courseId: number) {
    const unenrollmentPromises = userIds.map(userId =>
      this.enrollmentService.unenrollUser(userId, courseId)
    );

    return Promise.all(unenrollmentPromises);
  }
}
