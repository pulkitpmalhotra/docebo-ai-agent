import { parse } from 'papaparse';
import { BulkEnrollmentService } from './BulkEnrollmentService';

interface EnrollmentCSVRow {
  userId: number;
  courseId: number;
}

export class CSVEnrollmentService {
  private bulkEnrollmentService: BulkEnrollmentService;

  constructor() {
    this.bulkEnrollmentService = new BulkEnrollmentService();
  }

  async enrollFromCSV(csvData: string) {
    const { data } = await parse<EnrollmentCSVRow>(csvData, {
      header: true,
      skipEmptyLines: true,
      transform: ({ userId, courseId }) => ({
        userId: parseInt(userId, 10),
        courseId: parseInt(courseId, 10),
      }),
    });

    const enrollmentPromises = data.map(({ userId, courseId }) =>
      this.bulkEnrollmentService.enrollUsersInCourse([userId], courseId)
    );

    return Promise.all(enrollmentPromises);
  }

  // Add more CSV enrollment-related methods as needed
}
