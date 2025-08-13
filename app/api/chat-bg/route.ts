// app/api/chat-bg/route.ts - Robust Background Processing with Persistent Storage
import { NextRequest, NextResponse } from 'next/server';

// Global job storage with persistence
const jobStorage = new Map();
const enrollmentCache = new Map();

// Cleanup old jobs (older than 1 hour)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  for (const [jobId, job] of jobStorage.entries()) {
    if (job.startTime < oneHourAgo) {
      console.log(`🧹 Cleaning up old job: ${jobId}`);
      jobStorage.delete(jobId);
    }
  }
}, 5 * 60 * 1000); // Run every 5 minutes

interface Job {
  id: string;
  status: 'initializing' | 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
  userEmail: string;
  userId: string;
  logs: string[];
  lastActivity: number; // Track last activity
}

// Generate unique job ID
function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Background processing class
class BackgroundEnrollmentProcessor {
  private config: any;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private baseUrl: string;

  constructor(config: any) {
    this.config = config;
    this.baseUrl = `https://${config.domain}`;
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        scope: 'api',
        username: this.config.username,
        password: this.config.password,
      }),
    });

    if (!response.ok) {
      throw new Error(`Token request failed: ${response.status}`);
    }

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    return this.accessToken!;
  }

  public async apiRequest(endpoint: string, params?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    let url = `${this.baseUrl}${endpoint}`;
    if (params) {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          queryParams.append(key, value.toString());
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams}`;
      }
    }

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }

  public async findUserByEmail(email: string): Promise<any> {
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    return users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
  }

  // Synchronous version that immediately returns results
  async processUserEnrollmentsSync(jobId: string, userId: string, userEmail: string): Promise<void> {
    console.log(`🚀 SYNC: Starting job ${jobId} for user ${userId}`);
    
    const job = jobStorage.get(jobId) as Job;
    if (!job) {
      console.error(`❌ SYNC: Job ${jobId} not found in storage`);
      return;
    }

    // Update job status
    job.status = 'processing';
    job.progress = 10;
    job.lastActivity = Date.now();
    job.logs.push(`${new Date().toISOString()}: SYNC processing started`);
    jobStorage.set(jobId, job); // Ensure it's saved

    try {
      // Get just the first page for immediate results
      console.log(`📚 SYNC: Fetching first page for job ${jobId}`);
      
      const result = await this.apiRequest('/course/v1/courses/enrollments', {
        'user_ids[]': userId,
        page_size: 100,
        page: 1
      });

      const pageEnrollments = result.data?.items || [];
      const userEnrollments = pageEnrollments.filter((enrollment: any) => {
        return enrollment.user_id === Number(userId);
      });

      console.log(`📚 SYNC: Found ${userEnrollments.length} enrollments for job ${jobId}`);

      // Format results
      const processedEnrollments = this.formatEnrollments(userEnrollments);

      // Update job to completed
      job.status = 'completed';
      job.progress = 100;
      job.endTime = Date.now();
      job.lastActivity = Date.now();
      job.result = {
        enrollments: processedEnrollments,
        totalCount: userEnrollments.length,
        pagesProcessed: 1,
        method: 'sync'
      };
      job.logs.push(`${new Date().toISOString()}: SYNC processing completed - ${userEnrollments.length} enrollments`);

      // Save to storage
      jobStorage.set(jobId, job);

      // Cache results
      const cacheKey = `enrollments_${userId}`;
      enrollmentCache.set(cacheKey, {
        data: processedEnrollments,
        timestamp: Date.now(),
        totalCount: userEnrollments.length
      });

      console.log(`✅ SYNC: Job ${jobId} completed successfully`);

    } catch (error) {
      console.error(`❌ SYNC: Job ${jobId} failed:`, error);
      
      job.status = 'failed';
      job.endTime = Date.now();
      job.lastActivity = Date.now();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.logs.push(`${new Date().toISOString()}: SYNC processing failed - ${job.error}`);
      
      // Save failed job
      jobStorage.set(jobId, job);
    }
  }
  
  private formatEnrollments(enrollments: any[]): any[] {
    return enrollments.map(e => ({
      courseName: e.course_name || 'Unknown Course',
      courseType: e.course_type || 'unknown',
      enrollmentStatus: e.enrollment_status || 'unknown',
      enrollmentDate: e.enrollment_created_at,
      score: e.enrollment_score || 0,
      assignmentType: e.assignment_type
    }));
  }
}

// Initialize processor
let processor: BackgroundEnrollmentProcessor;

function getConfig() {
  return {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  };
}

// POST: Start background job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;
    
    console.log(`📥 Background job request: ${message}`);
    
    // Parse the message to extract email
    const emailMatch = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    
    if (!emailMatch) {
      return NextResponse.json({
        response: '❌ Please provide a valid email address in your message.',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }
    
    const email = emailMatch[0];
    console.log(`📧 Email extracted: ${email}`);
    
    // Check cache first
    const cacheKey = `enrollments_${email}`;
    if (enrollmentCache.has(cacheKey)) {
      const cached = enrollmentCache.get(cacheKey);
      const cacheAge = Date.now() - cached.timestamp;
      
      if (cacheAge < 3600000) { // 1 hour
        const ageMinutes = Math.floor(cacheAge / 60000);
        console.log(`💾 Returning cached results for ${email}`);
        
        return NextResponse.json({
          response: `📚 **${email}'s Courses** (${cached.totalCount} total) 

*Cached results from ${ageMinutes} minutes ago*

${cached.data.slice(0, 20).map((course: any, i: number) => 
  `${i + 1}. ${course.enrollmentStatus.toUpperCase()} - ${course.courseName} [${course.courseType.toUpperCase()}]`
).join('\n')}

${cached.totalCount > 20 ? `\n... and ${cached.totalCount - 20} more courses` : ''}

🔄 *To refresh data, wait 1 hour or contact support*`,
          success: true,
          cached: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // Initialize processor if needed
    if (!processor) {
      console.log('🔧 Initializing processor...');
      processor = new BackgroundEnrollmentProcessor(getConfig());
    }
    
    // Find user first
    console.log(`🔍 Finding user: ${email}`);
    const user = await processor.findUserByEmail(email);
    
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return NextResponse.json({
        response: `❌ **User Not Found**: ${email}

No user found with that email address in the system.`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    // Create background job
    const jobId = generateJobId();
    const job: Job = {
      id: jobId,
      status: 'initializing',
      progress: 0,
      startTime: Date.now(),
      lastActivity: Date.now(),
      userEmail: email,
      userId: user.user_id.toString(),
      logs: [
        `${new Date().toISOString()}: Job created for user ${user.fullname} (${email})`,
        `${new Date().toISOString()}: User ID: ${user.user_id}`
      ]
    };
    
    // Save job to storage BEFORE starting processing
    jobStorage.set(jobId, job);
    console.log(`📋 Job stored: ${jobId} (Total jobs: ${jobStorage.size})`);
    console.log(`📋 Jobs in storage: ${Array.from(jobStorage.keys()).join(', ')}`);
    
    // Start synchronous processing (wait for it to complete)
    try {
      await processor.processUserEnrollmentsSync(jobId, user.user_id.toString(), email);
      console.log(`✅ Job ${jobId} processing completed`);
    } catch (processingError) {
      console.error(`❌ Job ${jobId} processing failed:`, processingError);
      
      // Update job with error
      const failedJob = jobStorage.get(jobId) as Job;
      if (failedJob) {
        failedJob.status = 'failed';
        failedJob.error = processingError instanceof Error ? processingError.message : 'Processing failed';
        failedJob.endTime = Date.now();
        failedJob.lastActivity = Date.now();
        failedJob.logs.push(`${new Date().toISOString()}: Processing failed - ${failedJob.error}`);
        jobStorage.set(jobId, failedJob);
      }
    }
    
    // Return response immediately
    return NextResponse.json({
      response: `🚀 **Processing Request**

⏳ Finding all courses for **${user.fullname}** (${email})...

Processing is starting now. Check the status below.

📋 **Job ID**: \`${jobId}\`

💡 **Next Steps**: 
- Ask: "Check status of ${jobId}"
- Processing should complete within 10-30 seconds`,
      success: true,
      jobId: jobId,
      processing: true,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Background job start error:', error);
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

// GET: Check job status
export async function GET(request: NextRequest) {
  try {
    const jobId = request.nextUrl.searchParams.get('jobId');
    
    if (!jobId) {
      return NextResponse.json({
        response: '❌ Job ID is required',
        success: false
      }, { status: 400 });
    }
    
    console.log(`📊 Status check for job: ${jobId}`);
    console.log(`📊 Total jobs in storage: ${jobStorage.size}`);
    console.log(`📊 Jobs in storage: ${Array.from(jobStorage.keys()).join(', ')}`);
    
    const job = jobStorage.get(jobId) as Job;
    
    if (!job) {
      const availableJobs = Array.from(jobStorage.keys());
      return NextResponse.json({
        response: `❌ **Job Not Found**: ${jobId}

**Debug Info**:
- Total jobs in storage: ${jobStorage.size}
- Available jobs: ${availableJobs.join(', ') || 'None'}
- Job might have been cleaned up or never created

Try creating a new job.`,
        success: false,
        availableJobs: availableJobs
      }, { status: 404 });
    }
    
    // Update last activity
    job.lastActivity = Date.now();
    jobStorage.set(jobId, job);
    
    const elapsedTime = Math.floor((Date.now() - job.startTime) / 1000);
    
    if (job.status === 'initializing') {
      return NextResponse.json({
        response: `🔄 **Initializing** (${elapsedTime}s elapsed)

📊 **Progress**: ${job.progress}%
👤 **User**: ${job.userEmail}
🔄 **Status**: Setting up processing...

**Logs**:
${job.logs.slice(-5).join('\n')}`,
        success: true,
        jobId: jobId,
        status: job.status,
        progress: job.progress,
        processing: true,
        timestamp: new Date().toISOString()
      });
    }
    
    if (job.status === 'processing') {
      return NextResponse.json({
        response: `⏳ **Processing in Progress** (${elapsedTime}s elapsed)

📊 **Progress**: ${job.progress}%
👤 **User**: ${job.userEmail}
🔄 **Status**: Finding enrollment data...

**Logs**:
${job.logs.slice(-5).join('\n')}`,
        success: true,
        jobId: jobId,
        status: job.status,
        progress: job.progress,
        processing: true,
        timestamp: new Date().toISOString()
      });
    }
    
    if (job.status === 'completed') {
      const processingTime = job.endTime ? Math.floor((job.endTime - job.startTime) / 1000) : elapsedTime;
      
      return NextResponse.json({
        response: `📚 **${job.userEmail}'s Courses** (${job.result.totalCount} total)

✅ **Completed** in ${processingTime} seconds

${job.result.enrollments.slice(0, 25).map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${i + 1}. ${statusIcon} ${course.enrollmentStatus.toUpperCase()} - ${course.courseName} [${course.courseType.toUpperCase()}]${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${job.result.totalCount > 25 ? `\n... and ${job.result.totalCount - 25} more courses` : ''}

📊 **Summary**: 
- **Total Enrollments**: ${job.result.totalCount}
- **Pages Processed**: ${job.result.pagesProcessed}
- **Processing Time**: ${processingTime} seconds
- **Method**: ${job.result.method}`,
        success: true,
        jobId: jobId,
        status: job.status,
        enrollments: job.result.enrollments,
        totalCount: job.result.totalCount,
        completed: true,
        timestamp: new Date().toISOString()
      });
    }
    
    if (job.status === 'failed') {
      return NextResponse.json({
        response: `❌ **Job Failed** 

**Error**: ${job.error}
**User**: ${job.userEmail}
**Duration**: ${elapsedTime} seconds

**Error Logs**:
${job.logs.join('\n')}

Please try again or contact support if the issue persists.`,
        success: false,
        jobId: jobId,
        status: job.status,
        error: job.error,
        logs: job.logs,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Status check error:', error);
    return NextResponse.json({
      response: `❌ **Status Check Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
