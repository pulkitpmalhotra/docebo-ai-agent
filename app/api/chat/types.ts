// app/api/chat/types.ts - Enhanced TypeScript interfaces and types

export interface IntentAnalysis {
  intent: string;
  entities: any;
  confidence: number;
}

export interface DoceboConfig {
  domain: string;
  clientId: string;
  clientSecret: string;
  username: string;
  password: string;
}

export interface UserDetails {
  id: string;
  fullname: string;
  email: string;
  username: string;
  status: string;
  level: string;
  creationDate: string;
  lastAccess: string;
  timezone: string;
  language: string;
  department: string;
}

export interface EnhancedUserDetails extends UserDetails {
  manager?: {
    id: string;
    fullname: string;
    email: string;
    department?: string;
  } | null;
  additionalFields?: {
    jobTitle?: string;
    employeeId?: string;
    location?: string;
    directReports?: number;
  };
}

export interface EnrollmentData {
  courses: {
    enrollments: any[];
    totalCount: number;
    endpoint: string;
    success: boolean;
  };
  learningPlans: {
    enrollments: any[];
    totalCount: number;
    endpoint: string;
    success: boolean;
  };
  totalCourses: number;
  totalLearningPlans: number;
  success: boolean;
  error?: string;
}

export interface FormattedEnrollment {
  courseId?: string;
  courseName?: string;
  learningPlanId?: string;
  learningPlanName?: string;
  enrollmentStatus: string;
  enrollmentDate?: string;
  completionDate?: string;
  progress: number;
  score?: number;
  dueDate?: string;
  assignmentType?: string;
  completedCourses?: number;
  totalCourses?: number;
}

export interface APIResponse {
  response: string;
  success: boolean;
  data?: any;
  timestamp: string;
  totalCount?: number;
  helpRequest?: boolean;
}

export interface ManagerDetails {
  id: string;
  fullname: string;
  email: string;
  department?: string;
  jobTitle?: string;
  directReports?: number;
}

export interface UserSearchResult {
  user: EnhancedUserDetails;
  hasManagerInfo: boolean;
  totalCount: number;
  isDetailedView: boolean;
}
