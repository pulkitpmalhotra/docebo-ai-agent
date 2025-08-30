export interface Enrollment {
  id: number;
  userId: number;
  courseId: number;
  status: string;
  enrolledAt: Date;
  completedAt?: Date;
  progress: number;
  lastAccessedAt: Date;
  expirationDate: Date;
  enrollmentType: string;
  purchaseOrderId: number;
  // Add more fields as needed
}
