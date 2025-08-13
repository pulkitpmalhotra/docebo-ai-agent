// app/api/chat-bg/route.ts - Background Processing Chat API with Enhanced Debugging
import { NextRequest, NextResponse } from 'next/server';

// Job storage (in production, use Redis or a database)
const jobStorage = new Map();
const enrollmentCache = new Map();

interface Job {
  id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  result?: any;
  error?: string;
  userEmail: string;
  userId: string;
  logs: string[]; // Add logging for debugging
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
    console.log('🔑 Getting access token...');
    
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      console.log('✅ Using cached access token');
      return this.accessToken;
    }

    console.log('🔄 Requesting new access token...');
    
    try {
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
        throw new Error(`Token request failed: ${response.status} ${response.statusText}`);
      }

      const tokenData = await response.json();
      
      if (!tokenData.access_token) {
        throw new Error('No access token in response');
      }
      
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
      
      console.log('✅ New access token obtained');
      return this.accessToken!;
    } catch (error) {
      console.error('❌ Token request failed:', error);
      throw error;
    }
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

    console.log(`🌐 API Request: ${endpoint}`, params);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API error: ${response.status} - ${errorText}`);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`✅ API Response: ${endpoint} - ${JSON.stringify(data).substring(0, 200)}...`);
    return data;
  }

  public async findUserByEmail(email: string): Promise<any> {
    console.log(`🔍 Searching for user: ${email}`);
    
    try {
      const users = await this.apiRequest('/manage/v1/user', {
        search_text: email,
        page_size: 5
      });
      
      const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
      
      if (user) {
        console.log(`✅ User found: ${user.fullname} (ID: ${user.user_id})`);
      } else {
        console.log(`❌ User not found: ${email}`);
      }
      
      return user;
    } catch (error) {
      console.error(`❌ User search failed for ${email}:`, error);
      throw error;
    }
  }

  async processUserEnrollments(jobId: string, userId: string, userEmail: string): Promise<void> {
    const job = jobStorage.get(jobId) as Job;
    
    if (!job) {
      console.error(`❌ Job ${jobId} not found in storage`);
      return;
    }
    
    job.logs = [`${new Date().toISOString()}: Job started`];
    
    try {
      console.log(`🚀 Background job ${jobId} started for user ${userId}`);
      job.logs.push(`${new Date().toISOString()}: Background processing started for user ${userId}`);
      
      let allEnrollments: any[] = [];
      let currentPage = 1;
      let hasMoreData = true;
      const maxPages = 50; // Reduced for testing
      
      // Update job progress
      job.progress = 10;
      job.status = 'processing';
      job.logs.push(`${new Date().toISOString()}: Initial setup complete, starting enrollment fetch`);
      
      while (hasMoreData && currentPage <= maxPages) {
        console.log(`📚 Background job ${jobId}: Fetching page ${currentPage}`);
        job.logs.push(`${new Date().toISOString()}: Fetching page ${currentPage}`);
        
        try {
          const result = await this.apiRequest('/course/v1/courses/enrollments', {
            'user_ids[]': userId,
            page_size: 200,
            page: currentPage
          });
          
          const pageEnrollments = result.data?.items || [];
          job.logs.push(`${new Date().toISOString()}: Page ${currentPage} returned ${pageEnrollments.length} items`);
          
          // Filter for the specific user
          const userEnrollments = pageEnrollments.filter((enrollment: any) => {
            return enrollment.user_id === Number(userId);
          });
          
          allEnrollments.push(...userEnrollments);
          
          // Update progress (10% to 90% during data collection)
          job.progress = Math.min(90, 10 + Math.floor((currentPage / maxPages) * 80));
          
          console.log(`📚 Background job ${jobId}: Page ${currentPage} - Found ${userEnrollments.length} enrollments (Total: ${allEnrollments.length})`);
          job.logs.push(`${new Date().toISOString()}: Page ${currentPage} complete - ${userEnrollments.length} user enrollments found (Total: ${allEnrollments.length})`);
          
          hasMoreData = result.data?.has_more_data === true;
          
          if (pageEnrollments.length === 0) {
            hasMoreData = false;
            job.logs.push(`${new Date().toISOString()}: No more data available`);
          }
          
          currentPage++;
          
          // Small delay to be API-friendly
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (pageError) {
          console.error(`❌ Error fetching page ${currentPage}:`, pageError);
          job.logs.push(`${new Date().toISOString()}: Error on page ${currentPage}: ${pageError instanceof Error ? pageError.message : 'Unknown error'}`);
          
          // If we have some data, continue; if first page fails, abort
          if (currentPage === 1) {
            throw pageError;
          } else {
            hasMoreData = false;
          }
        }
      }
      
      // Process and format the results
      job.progress = 95;
      job.logs.push(`${new Date().toISOString()}: Processing ${allEnrollments.length} enrollments`);
      
      const processedEnrollments = this.formatEnrollments(allEnrollments);
      
      // Complete the job
      job.status = 'completed';
      job.progress = 100;
      job.endTime = Date.now();
      job.result = {
        enrollments: processedEnrollments,
        totalCount: allEnrollments.length,
        pagesProcessed: currentPage - 1
      };
      job.logs.push(`${new Date().toISOString()}: Job completed successfully`);
      
      // Cache the results for 1 hour
      const cacheKey = `enrollments_${userId}`;
      enrollmentCache.set(cacheKey, {
        data: processedEnrollments,
        timestamp: Date.now(),
        totalCount: allEnrollments.length
      });
      
      console.log(`✅ Background job ${jobId} completed: ${allEnrollments.length} enrollments found`);
      
    } catch (error) {
      console.error(`❌ Background job ${jobId} failed:`, error);
      job.status = 'failed';
      job.endTime = Date.now();
      job.error = error instanceof Error ? error.message : 'Unknown error';
      job.logs.push(`${new Date().toISOString()}: Job failed - ${job.error}`);
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
  const config = {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  };
  
  console.log('🔧 Config loaded:', {
    domain: config.domain,
    clientId: config.clientId ? `${config.clientId.substring(0, 8)}...` : 'missing',
    username: config.username || 'missing'
  });
  
  return config;
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
      
      // Return cached results if less than 1 hour old
      if (cacheAge < 3600000) {
        const ageMinutes = Math.floor(cacheAge / 60000);
        console.log(`💾 Returning cached results for ${email} (${ageMinutes} minutes old)`);
        
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
    
    // Find user first (quick operation)
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
      status: 'processing',
      progress: 0,
      startTime: Date.now(),
      userEmail: email,
      userId: user.user_id.toString(),
      logs: [`${new Date().toISOString()}: Job created for user ${user.fullname} (${email})`]
    };
    
    jobStorage.set(jobId, job);
    console.log(`📋 Job created: ${jobId} for user ${user.fullname} (${user.user_id})`);
    
    // Start background processing (don't await)
    processor.processUserEnrollments(jobId, user.user_id.toString(), email)
      .catch(error => {
        console.error(`❌ Background processing error for job ${jobId}:`, error);
        const job = jobStorage.get(jobId) as Job;
        if (job) {
          job.status = 'failed';
          job.error = error instanceof Error ? error.message : 'Unknown error';
          job.endTime = Date.now();
        }
      });
    
    return NextResponse.json({
      response: `🚀 **Processing Request**

⏳ Finding all courses for **${user.fullname}** (${email})...

This may take 30-60 seconds to complete. Your request is being processed in the background.

📋 **Job ID**: \`${jobId}\`

💡 **Next Steps**: 
- I'll automatically check the status in a moment
- You can also ask: "Check status of ${jobId}"
- Or simply wait and I'll update you when it's done`,
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
    console.log(`📊 Jobs in storage: ${Array.from(jobStorage.keys()).join(', ')}`);
    
    const job = jobStorage.get(jobId) as Job;
    
    if (!job) {
      return NextResponse.json({
        response: `❌ **Job Not Found**: ${jobId}

The job may have expired or never existed.

**Available Jobs**: ${Array.from(jobStorage.keys()).join(', ') || 'None'}`,
        success: false
      }, { status: 404 });
    }
    
    const elapsedTime = Math.floor((Date.now() - job.startTime) / 1000);
    
    if (job.status === 'processing') {
      return NextResponse.json({
        response: `⏳ **Processing in Progress** (${elapsedTime}s elapsed)

📊 **Progress**: ${job.progress}%
👤 **User**: ${job.userEmail}
🔄 **Status**: Finding enrollment data...

**Recent Logs**:
${job.logs.slice(-3).join('\n')}

*Please wait, this process can take up to 60 seconds*`,
        success: true,
        jobId: jobId,
        status: job.status,
        progress: job.progress,
        processing: true,
        logs: job.logs,
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
- **Processing Time**: ${processingTime} seconds`,
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
