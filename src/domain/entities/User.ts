export interface User {
  id: number;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  role: string;
  language: string;
  timezone: string;
  country: string;
  manager: string;
  branch: string;
  department: string;
  team: string;
  profilePictureUrl: string;
  // Add more fields as needed
}
