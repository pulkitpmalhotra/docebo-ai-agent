export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  status: string;
  enrolledAt: Date;
  completedAt?: Date;
}
