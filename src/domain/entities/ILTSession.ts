export interface ILTSession {
  id: number;
  name: string;
  description: string;
  courseId: number;
  startDate: Date;
  endDate: Date;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  instructors: string[];
  location: string;
  capacity: number;
  enrolledCount: number;
  waitlistCount: number;
  minEnrollments: number;
  maxEnrollments: number;
  enrollmentDeadline: Date;
  cancellationDeadline: Date;
  // Add more fields as needed
}
