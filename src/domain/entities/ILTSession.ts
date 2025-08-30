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
}
