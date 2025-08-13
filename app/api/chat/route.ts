// app/api/chat/route.ts - Enhanced with Pagination and CSV Export
import { NextRequest, NextResponse } from 'next/server';

// Cache for storing paginated data
const paginationCache = new Map();

// Environment configuration
function validateEnvironmentVariable(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function getConfig() {
  return {
    domain: validateEnvironmentVariable('DOCEBO_DOMAIN', process.env.DOCEBO_DOMAIN),
    clientId: validateEnvironmentVariable('DOCEBO_CLIENT_ID', process.env.DOCEBO_CLIENT_ID),
    clientSecret: validateEnvironmentVariable('DOCEBO_CLIENT_SECRET', process.env.DOCEBO_CLIENT_SECRET),
    username: validateEnvironmentVariable('DOCEBO_USERNAME', process.env.DOCEBO_USERNAME),
    password: validateEnvironmentVariable('DOCEBO_PASSWORD', process.env.DOCEBO_PASSWORD),
  };
}

// Enhanced patterns
const PATTERNS = {
  searchUsers: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find user') || lower.includes('search user')) && 
           !lower.includes('course');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  enrollmentCheck: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('what courses') || 
           (lower.includes('courses') && lower.includes('enrolled'));
  },
  loadMore: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('load more') || lower.includes('show more') || lower.includes('next 20');
  },
  exportCsv: (msg: string) => {
    const lower = msg.toLowerCase();
    return lower.includes('csv') || lower.includes('export') || lower.includes('download') || lower.includes('spreadsheet');
  }
};

// Parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractCourse(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

function extractCacheKey(message: string): string | null {
  const match = message.match(/cache_([a-f0-9]+)/);
  return match ? match[1] : null;
}

// Enhanced Docebo API client
class EnhancedDoceboAPI {
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

    const tokenData = await response.json();
    this.accessToken = tokenData.access_token;
    this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000);
    
    return this.accessToken!;
  }

  private async apiRequest(endpoint: string, params?: any): Promise<any> {
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
      throw new Error(`Docebo API error: ${response.status}`);
    }

    return await response.json();
  }

  async searchUsers(searchText: string, limit: number = 20): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 20): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async getAllEnrollments(email: string, maxPages: number = 10): Promise<any> {
    // Find user first
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    console.log(`📚 Getting enrollments for ${user.fullname} (${user.user_id})`);

    let allEnrollments: any[] = [];
    let currentPage = 1;
    
    // Get multiple pages to collect more data
    while (currentPage <= maxPages) {
      console.log(`📄 Fetching page ${currentPage}...`);
      
      try {
        const result = await this.apiRequest('/course/v1/courses/enrollments', {
          'user_ids[]': user.user_id,
          page_size: 200,
          page: currentPage
        });
        
        const pageEnrollments = result.data?.items || [];
        
        // Filter for the specific user
        const userEnrollments = pageEnrollments.filter((enrollment: any) => {
          return enrollment.user_id === Number(user.user_id);
        });
        
        allEnrollments.push(...userEnrollments);
        
        console.log(`📄 Page ${currentPage}: Found ${userEnrollments.length} enrollments (Total: ${allEnrollments.length})`);
        
        // Check if there's more data
        const hasMoreData = result.data?.has_more_data === true;
        
        if (!hasMoreData || pageEnrollments.length === 0) {
          console.log(`✅ No more data available after page ${currentPage}`);
          break;
        }
        
        currentPage++;
        
        // Small delay to be API-friendly
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (pageError) {
        console.error(`❌ Error fetching page ${currentPage}:`, pageError);
        
        // If first page fails, throw error; otherwise continue with what we have
        if (currentPage === 1) {
          throw pageError;
        } else {
          console.log(`⚠️ Continuing with ${allEnrollments.length} enrollments from previous pages`);
          break;
        }
      }
    }
    
    // Format enrollments
    const processedEnrollments = allEnrollments.map((e: any) => ({
      courseName: e.course_name || 'Unknown Course',
      courseType: e.course_type || 'unknown',
      enrollmentStatus: e.enrollment_status || 'unknown',
      enrollmentDate: e.enrollment_created_at,
      score: e.enrollment_score || 0,
      assignmentType: e.assignment_type,
      courseId: e.course_id
    }));
    
    console.log(`✅ Total enrollments processed: ${processedEnrollments.length}`);
    
    return {
      user: user,
      allEnrollments: processedEnrollments,
      totalCount: processedEnrollments.length,
      pagesProcessed: currentPage - 1
    };
  }

  getCourseId(course: any): number | null {
    return course.id || course.course_id || course.idCourse || null;
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }
}

// Generate cache key for storing results
function generateCacheKey(): string {
  return Math.random().toString(36).substr(2, 8);
}

// Generate CSV content
function generateCSV(enrollments: any[], userInfo: any): string {
  const headers = ['Course Name', 'Course Type', 'Enrollment Status', 'Enrollment Date', 'Score', 'Assignment Type', 'Course ID'];
  
  const csvContent = [
    `# ${userInfo.fullname} (${userInfo.email}) - Course Enrollments`,
    `# Generated on ${new Date().toISOString()}`,
    `# Total Enrollments: ${enrollments.length}`,
    '',
    headers.join(','),
    ...enrollments.map((e: any) => [
      `"${e.courseName.replace(/"/g, '""')}"`,
      e.courseType,
      e.enrollmentStatus,
      e.enrollmentDate || '',
      e.score || 0,
      e.assignmentType || '',
      e.courseId || ''
    ].join(','))
  ].join('\n');
  
  return csvContent;
}

let api: EnhancedDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new EnhancedDoceboAPI(config);
    }

    const body = await request.json();
    const { message } = body;
    
    if (!message || typeof message !== 'string') {
      return NextResponse.json({
        response: '❌ Please provide a valid message',
        success: false,
        timestamp: new Date().toISOString()
      }, { status: 400 });
    }

    console.log(`🤖 Processing: "${message}"`);
    
    // Parse message
    const email = extractEmail(message);
    const course = extractCourse(message);
    const cacheKey = extractCacheKey(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}, CacheKey: ${cacheKey}`);
    
    // LOAD MORE functionality
    if (PATTERNS.loadMore(message) && cacheKey) {
      console.log(`📄 Load more request for cache: ${cacheKey}`);
      
      const cachedData = paginationCache.get(cacheKey);
      if (!cachedData) {
        return NextResponse.json({
          response: `❌ **Session Expired**: The data for "load more" is no longer available.

Please run the original query again to get fresh results.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const { allEnrollments, user, currentPage } = cachedData;
      const startIndex = currentPage * 20;
      const endIndex = Math.min(startIndex + 20, allEnrollments.length);
      const pageResults = allEnrollments.slice(startIndex, endIndex);
      const newPage = currentPage + 1;
      
      // Update cache with new page
      paginationCache.set(cacheKey, {
        ...cachedData,
        currentPage: newPage
      });
      
      const hasMore = endIndex < allEnrollments.length && endIndex < 100;
      
      return NextResponse.json({
        response: `📚 **${user.email}'s Courses** (Showing ${startIndex + 1}-${endIndex} of ${allEnrollments.length})

${pageResults.map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${startIndex + i + 1}. ${statusIcon} **${course.enrollmentStatus.toUpperCase()}** - ${course.courseName}${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${hasMore ? `\n🔄 **Load More**: "Load more cache_${cacheKey}" (Up to 100 total)` : ''}
${allEnrollments.length > 100 ? `\n📊 **Full Export**: "Export CSV cache_${cacheKey}" (All ${allEnrollments.length} enrollments)` : ''}`,
        success: true,
        hasMore: hasMore,
        totalCount: allEnrollments.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // CSV EXPORT functionality
    if (PATTERNS.exportCsv(message) && cacheKey) {
      console.log(`📊 CSV export request for cache: ${cacheKey}`);
      
      const cachedData = paginationCache.get(cacheKey);
      if (!cachedData) {
        return NextResponse.json({
          response: `❌ **Session Expired**: The data for CSV export is no longer available.

Please run the original query again to get fresh results.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const { allEnrollments, user } = cachedData;
      const csvContent = generateCSV(allEnrollments, user);
      const base64Csv = Buffer.from(csvContent).toString('base64');
      
      return NextResponse.json({
        response: `📊 **CSV Export Ready** for ${user.fullname}

📁 **File**: ${user.fullname.replace(/\s+/g, '_')}_enrollments.csv
📈 **Total Records**: ${allEnrollments.length}
📅 **Generated**: ${new Date().toLocaleDateString()}

**Download Instructions**:
1. Copy the data below
2. Create a new file with .csv extension
3. Paste the data and save

**CSV Data** (copy all text below):
\`\`\`
${csvContent}
\`\`\`

💡 You can also open this in Excel, Google Sheets, or any spreadsheet application.`,
        success: true,
        csvData: csvContent,
        base64Csv: base64Csv,
        fileName: `${user.fullname.replace(/\s+/g, '_')}_enrollments.csv`,
        timestamp: new Date().toISOString()
      });
    }
    
    // 1. SEARCH USERS
    if (PATTERNS.searchUsers(message)) {
      const searchTerm = email || message.replace(/find|user|search/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a name or email to search for.

**Example**: "Find user mike@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const users = await api.searchUsers(searchTerm, 50);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(users.length, 20);
      const userList = users.slice(0, displayCount).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users (Showing ${displayCount})

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}`,
        success: true,
        totalCount: users.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 2. SEARCH COURSES  
    if (PATTERNS.searchCourses(message)) {
      const searchTerm = course || message.replace(/find|search|course/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a course name to search for.

**Example**: "Find Python courses"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const courses = await api.searchCourses(searchTerm, 50);
      
      if (courses.length === 0) {
        return NextResponse.json({
          response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(courses.length, 20);
      const courseList = courses.slice(0, displayCount).map((course, i) => {
        const courseName = api.getCourseName(course);
        const courseId = api.getCourseId(course);
        return `${i + 1}. **${courseName}** (ID: ${courseId})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses (Showing ${displayCount})

${courseList}${courses.length > 20 ? `\n\n... and ${courses.length - 20} more courses` : ''}`,
        success: true,
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 3. ENROLLMENT CHECK with Pagination
    if (PATTERNS.enrollmentCheck(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to check enrollments.

**Example**: "What courses is john@company.com enrolled in?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const enrollmentData = await api.getAllEnrollments(email, 10);
        const { user, allEnrollments, totalCount } = enrollmentData;
        
        // Store in pagination cache
        const cacheKey = generateCacheKey();
        paginationCache.set(cacheKey, {
          allEnrollments: allEnrollments,
          user: user,
          currentPage: 1,
          timestamp: Date.now()
        });
        
        // Show first 20 results
        const displayResults = allEnrollments.slice(0, 20);
        const hasMore = totalCount > 20;
        
        return NextResponse.json({
          response: `📚 **${email}'s Courses** (Showing 1-${displayResults.length} of ${totalCount})

👤 **User**: ${user.fullname}

${displayResults.map((course: any, i: number) => {
  let statusIcon = '📚';
  if (course.enrollmentStatus === 'completed') statusIcon = '✅';
  else if (course.enrollmentStatus === 'in_progress') statusIcon = '🔄';
  else if (course.enrollmentStatus === 'suspended') statusIcon = '🚫';
  
  return `${i + 1}. ${statusIcon} **${course.enrollmentStatus.toUpperCase()}** - ${course.courseName}${course.score ? ` (Score: ${course.score})` : ''}`;
}).join('\n')}

${hasMore ? `\n🔄 **Load More**: "Load more cache_${cacheKey}" (Show next 20)` : ''}
📊 **Export CSV**: "Export CSV cache_${cacheKey}" (All ${totalCount} enrollments)

💡 **Actions Available:**
${hasMore ? `- Type: "Load more cache_${cacheKey}" for next 20 results` : ''}
- Type: "Export CSV cache_${cacheKey}" for complete spreadsheet`,
          success: true,
          totalCount: totalCount,
          hasMore: hasMore,
          cacheKey: cacheKey,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        return NextResponse.json({
          response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // DEFAULT - Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Enhanced with Pagination & CSV Export*

I can help you with:

• **👥 Find users**: "Find user mike@company.com"

• **📖 Find courses**: "Find Python courses"

• **📚 Check enrollments**: "What courses is sarah@test.com enrolled in?"
  - Shows first 20 results
  - "Load more" for next 20 (up to 100 total)
  - "Export CSV" for complete data

• **📊 Pagination options**:
  - "Load more cache_xxxxx" (next 20 results)
  - "Export CSV cache_xxxxx" (all results)

**Your message**: "${message}"

**Examples:**
- "What courses is pulkitpmalhotra@gmail.com enrolled in?"
- "Load more cache_abc123" 
- "Export CSV cache_abc123"`,
      success: false,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Chat error:', error);
    
    return NextResponse.json({
      response: `❌ **System Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Enhanced Docebo Chat API with Pagination & CSV Export',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search (up to 50 results, show 20)',
      'Course search (up to 50 results, show 20)', 
      'Enrollment check with pagination (20 per page)',
      'Load more functionality (up to 100 results)',
      'CSV export for complete data',
      'Session-based caching for pagination'
    ],
    capabilities: [
      'Shows 20 results initially',
      'Load more for next 20 (up to 100 total displayed)',
      'CSV export for all results (no limit)',
      'Fast & reliable within 30-second limit'
    ]
  });
}
