function extractCourse(message: string): string | null {
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}// app/api/chat/route.ts - Clean & Reliable - Working Features Only
import { NextRequest, NextResponse } from 'next/server';

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

// Simple cache for storing search results
const searchCache = new Map();

// Generate cache key for storing results
function generateSearchCacheKey(): string {
  return `search_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
}
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
  getUserInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('user info') || lower.includes('user details') || 
            lower.includes('tell me about user')) && !lower.includes('course');
  },
  getCourseInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('course info') || lower.includes('course details') || 
            lower.includes('tell me about course'));
  },
  userQuestion: (msg: string) => {
    const lower = msg.toLowerCase();
    const hasEmail = msg.includes('@');
    
    // Check for user-specific questions with email
    return hasEmail && (
      lower.includes('what is') || lower.includes('when did') || 
      lower.includes('how many') || lower.includes('does') ||
      lower.includes('can ') || lower.includes('is ') ||
      lower.includes('what groups') || lower.includes('what branches') ||
      lower.includes('what level') || lower.includes('what status') ||
      lower.includes('last login') || lower.includes('last access') ||
      lower.includes('when ') || lower.includes('status') ||
      lower.includes('level') || lower.includes('groups') ||
      lower.includes('branches') || lower.includes('department')
    );
  },
  showAllResults: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('show all') || lower.includes('all results') || 
            lower.includes('all courses') || lower.includes('all users')) &&
           lower.includes('search_');
  }
};

// Parsers
function extractEmail(message: string): string | null {
  const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}

function extractSearchCacheKey(message: string): string | null {
  const match = message.match(/search_([a-f0-9A-F_]+)/);
  return match ? match[1] : null;
}
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

// Reliable Docebo API client
class ReliableDoceboAPI {
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

  async getUserDetails(email: string): Promise<any> {
    const users = await this.apiRequest('/manage/v1/user', {
      search_text: email,
      page_size: 5
    });
    
    const user = users.data?.items?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
    
    if (!user) {
      throw new Error(`User not found: ${email}`);
    }

    console.log(`🔍 Raw user data for ${email}:`, JSON.stringify(user, null, 2));

    // Try multiple API endpoints to get complete user data
    let additionalDetails = null;
    let branchDetails = null;
    let groupDetails = null;
    let userOrgDetails = null;

    // Try user-specific endpoint
    try {
      additionalDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}`);
      console.log(`📋 User-specific endpoint data:`, JSON.stringify(additionalDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ User-specific endpoint failed for ${user.user_id}:`, error);
    }

    // Try branches endpoint
    try {
      branchDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/branches`);
      console.log(`🏛️ User branches endpoint:`, JSON.stringify(branchDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Branches endpoint failed for ${user.user_id}:`, error);
    }

    // Try groups endpoint
    try {
      groupDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/groups`);
      console.log(`👥 User groups endpoint:`, JSON.stringify(groupDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Groups endpoint failed for ${user.user_id}:`, error);
    }

    // Try organizational units endpoint
    try {
      userOrgDetails = await this.apiRequest(`/manage/v1/orgchart/user/${user.user_id}`);
      console.log(`🏢 User org chart endpoint:`, JSON.stringify(userOrgDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Org chart endpoint failed for ${user.user_id}:`, error);
    }

    // Try alternative group/branch lookups
    let alternativeGroups = null;
    try {
      // Sometimes groups are in a different endpoint
      alternativeGroups = await this.apiRequest('/manage/v1/group', {
        user_id: user.user_id
      });
      console.log(`👥 Alternative groups search:`, JSON.stringify(alternativeGroups, null, 2));
    } catch (error) {
      console.log(`⚠️ Alternative groups search failed:`, error);
    }

    // Merge data from all sources
    const mergedUser = additionalDetails?.data || user;

    // Map user level to readable format
    const getUserLevel = (level: any): string => {
      if (!level) return 'Not specified';
      
      const levelStr = level.toString().toLowerCase();
      const levelNum = parseInt(level);
      
      // Map common Docebo levels
      switch (levelNum) {
        case 1:
        case 1024:
          return 'Superadmin';
        case 4:
        case 256:
          return 'Power User';
        case 6:
        case 64:
          return 'User Manager';
        case 7:
        case 32:
          return 'User';
        default:
          // Check string-based levels
          if (levelStr.includes('admin') || levelStr.includes('super')) return 'Superadmin';
          if (levelStr.includes('power')) return 'Power User';
          if (levelStr.includes('manager')) return 'User Manager';
          if (levelStr.includes('user')) return 'User';
          return `Level ${level}`;
      }
    };

    // Extract branches from all possible sources
    const extractBranches = (): string => {
      const sources = [
        branchDetails?.data?.items,
        branchDetails?.data,
        userOrgDetails?.data?.branches,
        mergedUser.branches,
        user.branches,
        mergedUser.branch,
        user.branch,
        user.branch_name,
        mergedUser.branch_name
      ];
      
      console.log(`🏛️ Checking branch sources:`, sources.map(s => s ? (Array.isArray(s) ? `Array(${s.length})` : typeof s) : 'null'));
      
      for (const source of sources) {
        try {
          if (Array.isArray(source) && source.length > 0) {
            const result = source.map((b: any) => {
              if (typeof b === 'string') return b;
              if (b && typeof b === 'object') {
                return b.name || b.branch_name || b.title || b.description || JSON.stringify(b);
              }
              return String(b);
            }).filter(Boolean).join(', ');
            console.log(`🏛️ Found branches from array:`, result);
            return result;
          }
          if (source && typeof source === 'object' && !Array.isArray(source)) {
            const result = source.name || source.branch_name || source.title || JSON.stringify(source);
            console.log(`🏛️ Found branches from object:`, result);
            return result;
          }
          if (typeof source === 'string' && source.trim()) {
            console.log(`🏛️ Found branches from string:`, source);
            return source;
          }
        } catch (error) {
          console.log(`⚠️ Error processing branch source:`, error);
          continue;
        }
      }
      return 'None assigned';
    };

    // Extract groups from all possible sources  
    const extractGroups = (): string => {
      const sources = [
        groupDetails?.data?.items,
        groupDetails?.data,
        alternativeGroups?.data?.items,
        userOrgDetails?.data?.groups,
        mergedUser.groups,
        user.groups,
        mergedUser.group,
        user.group,
        user.group_name,
        mergedUser.group_name
      ];
      
      console.log(`👥 Checking group sources:`, sources.map(s => s ? (Array.isArray(s) ? `Array(${s.length})` : typeof s) : 'null'));
      
      for (const source of sources) {
        try {
          if (Array.isArray(source) && source.length > 0) {
            const result = source.map((g: any) => {
              if (typeof g === 'string') return g;
              if (g && typeof g === 'object') {
                return g.name || g.group_name || g.title || g.description || JSON.stringify(g);
              }
              return String(g);
            }).filter(Boolean).join(', ');
            console.log(`👥 Found groups from array:`, result);
            return result;
          }
          if (source && typeof source === 'object' && !Array.isArray(source)) {
            const result = source.name || source.group_name || source.title || JSON.stringify(source);
            console.log(`👥 Found groups from object:`, result);
            return result;
          }
          if (typeof source === 'string' && source.trim()) {
            console.log(`👥 Found groups from string:`, source);
            return source;
          }
        } catch (error) {
          console.log(`⚠️ Error processing group source:`, error);
          continue;
        }
      }
      return 'None assigned';
    };

    const branches = extractBranches();
    const groups = extractGroups();

    return {
      id: user.user_id || user.id,
      fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Not available',
      email: user.email,
      username: user.username || 'Not available',
      status: user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : `Status: ${user.status}`,
      level: getUserLevel(user.level || mergedUser.level),
      
      // Use improved extraction methods
      branches: branches,
      groups: groups,
      
      // Try multiple date field formats
      creationDate: user.register_date || user.creation_date || user.created_at || mergedUser.register_date || 'Not available',
      lastAccess: user.last_access_date || user.last_access || user.last_login || mergedUser.last_access_date || 'Not available',
      
      timezone: user.timezone || mergedUser.timezone || 'Not specified',
      language: user.language || user.lang_code || mergedUser.language || 'Not specified',
      
      // Additional fields that might be available
      department: user.department || mergedUser.department || userOrgDetails?.data?.department || 'Not specified',
      
      // Enhanced debug info to see all available data
      debug: {
        userFields: Object.keys(user),
        additionalFields: additionalDetails?.data ? Object.keys(additionalDetails.data) : [],
        branchApiCalled: branchDetails ? 'Success' : 'Failed',
        groupApiCalled: groupDetails ? 'Success' : 'Failed',
        orgChartApiCalled: userOrgDetails ? 'Success' : 'Failed',
        alternativeGroupsApiCalled: alternativeGroups ? 'Success' : 'Failed',
        rawBranchData: branchDetails?.data || null,
        rawGroupData: groupDetails?.data || null,
        rawOrgData: userOrgDetails?.data || null,
        rawAlternativeGroups: alternativeGroups?.data || null
      }
    };
  }

  async getCourseDetails(courseName: string): Promise<any> {
    console.log(`🔍 Searching for course: ${courseName}`);
    
    // Try multiple search approaches
    let course = null;
    let allCourseData = [];
    
    // Method 1: /course/v1/courses
    try {
      const courses1 = await this.apiRequest('/course/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 1 (/course/v1/courses) found ${courses1.data?.items?.length || 0} courses`);
      if (courses1.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses1.data.items[0], null, 2));
        allCourseData.push(...courses1.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 1 failed:`, error);
    }
    
    // Method 2: /learn/v1/courses  
    try {
      const courses2 = await this.apiRequest('/learn/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 2 (/learn/v1/courses) found ${courses2.data?.items?.length || 0} courses`);
      if (courses2.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses2.data.items[0], null, 2));
        allCourseData.push(...courses2.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 2 failed:`, error);
    }
    
    // Method 3: /manage/v1/courses (if it exists)
    try {
      const courses3 = await this.apiRequest('/manage/v1/courses', {
        search_text: courseName,
        page_size: 20
      });
      
      console.log(`📚 Method 3 (/manage/v1/courses) found ${courses3.data?.items?.length || 0} courses`);
      if (courses3.data?.items?.length > 0) {
        console.log(`📋 Sample course data:`, JSON.stringify(courses3.data.items[0], null, 2));
        allCourseData.push(...courses3.data.items);
      }
    } catch (error) {
      console.log(`⚠️ Method 3 failed:`, error);
    }
    
    // Find best matching course from all results
    for (const courseList of [allCourseData]) {
      // Try exact match first
      course = courseList.find((c: any) => {
        const cName = (c.course_name || c.name || c.title || '').toLowerCase();
        return cName === courseName.toLowerCase();
      });
      
      // Then try partial match
      if (!course) {
        course = courseList.find((c: any) => {
          const cName = (c.course_name || c.name || c.title || '').toLowerCase();
          return cName.includes(courseName.toLowerCase()) || courseName.toLowerCase().includes(cName);
        });
      }
      
      if (course) break;
    }
    
    if (!course) {
      throw new Error(`Course not found: ${courseName}. Searched ${allCourseData.length} total courses.`);
    }

    console.log(`✅ Found course:`, JSON.stringify(course, null, 2));

    // Try to get detailed course information using course ID
    let detailedCourse = null;
    const courseId = course.id || course.course_id || course.idCourse;
    
    if (courseId) {
      // Try multiple endpoints for detailed info
      const detailEndpoints = [
        `/course/v1/courses/${courseId}`,
        `/learn/v1/courses/${courseId}`,
        `/manage/v1/courses/${courseId}`,
        `/course/v1/courses/${courseId}/info`,
        `/learn/v1/courses/${courseId}/info`
      ];
      
      for (const endpoint of detailEndpoints) {
        try {
          console.log(`🔍 Trying detailed endpoint: ${endpoint}`);
          detailedCourse = await this.apiRequest(endpoint);
          console.log(`✅ Got detailed data from ${endpoint}:`, JSON.stringify(detailedCourse, null, 2));
          break;
        } catch (error) {
          console.log(`⚠️ ${endpoint} failed:`, error);
        }
      }
    }

    // Extract all available fields with better mapping
    const extractField = (fieldName: string, possibleKeys: string[] = []): string => {
      const sources = [detailedCourse?.data, course];
      const allKeys = [
        fieldName,
        ...possibleKeys,
        fieldName.toLowerCase(),
        fieldName.replace(/_/g, ''),
        `course_${fieldName}`,
        `${fieldName}_name`
      ];
      
      for (const source of sources) {
        if (!source) continue;
        for (const key of allKeys) {
          const value = source[key];
          if (value !== undefined && value !== null && value !== '') {
            // Handle object values (like category)
            if (typeof value === 'object' && value.name) {
              return String(value.name);
            }
            if (typeof value === 'object' && value.title) {
              return String(value.title);
            }
            if (typeof value === 'object') {
              return JSON.stringify(value);
            }
            return String(value);
          }
        }
      }
      return 'Not available';
    };

    // Get all available field names for debugging
    const availableFields = new Set();
    [course, detailedCourse?.data].forEach(obj => {
      if (obj) Object.keys(obj).forEach(key => availableFields.add(key));
    });

    return {
      id: courseId || 'Not available',
      name: course.title || course.course_name || course.name || 'Unknown Course',
      description: extractField('description'),
      type: extractField('type', ['course_type', 'content_type', 'learning_object_type']),
      status: extractField('status', ['course_status', 'publication_status']),
      language: extractField('language', ['lang_code', 'default_language', 'course_language']),
      credits: extractField('credits', ['credit_hours', 'points']),
      duration: extractField('duration', ['mediumTime', 'estimated_duration', 'average_completion_time', 'time_estimation']),
      category: extractField('category', ['category_name', 'course_category']),
      creationDate: extractField('created', ['date_creation', 'created_at', 'creation_date', 'date_begin', 'created_on']),
      modificationDate: extractField('modified', ['last_update', 'updated_on', 'date_modification', 'modification_date']),
      code: extractField('code', ['course_code', 'sku']),
      level: extractField('level', ['difficulty_level', 'course_level']),
      price: extractField('price', ['cost', 'fee']),
      instructor: extractField('instructor', ['instructor_name', 'author', 'creator']),
      enrollments: extractField('enrollments', ['enrolled_count', 'enrolled_users', 'user_count']),
      rating: (() => {
        const rating = extractField('rating', ['average_rating', 'score']);
        try {
          const ratingObj = JSON.parse(rating);
          if (ratingObj.enabled === false) return 'Not enabled';
          return rating;
        } catch {
          return rating;
        }
      })(),
      // Additional fields that might be interesting
      certificate: extractField('certificate', ['has_certificate', 'certification']),
      // Debug information  
      debug: {
        foundFields: Array.from(availableFields).sort(),
        courseId: courseId,
        detailEndpointUsed: detailedCourse ? 'Success' : 'Failed',
        totalFieldsAvailable: availableFields.size,
        rawCourseKeys: Object.keys(course),
        rawDetailedKeys: detailedCourse?.data ? Object.keys(detailedCourse.data) : [],
        // Show first few raw values for debugging
        sampleData: Object.fromEntries(
          Object.entries(course).slice(0, 5).map(([k, v]) => [k, typeof v === 'object' ? '[object]' : v])
        )
      }
    };
  }

  getCourseId(course: any): number | null {
    return course.id || course.course_id || course.idCourse || null;
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }
}

let api: ReliableDoceboAPI;

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new ReliableDoceboAPI(config);
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
    const searchCacheKey = extractSearchCacheKey(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}, SearchCache: ${searchCacheKey}`);
    console.log(`🔍 Pattern matching - userQuestion: ${PATTERNS.userQuestion(message)}, searchUsers: ${PATTERNS.searchUsers(message)}, showAllResults: ${PATTERNS.showAllResults(message)}`);
    
    // 1. SHOW ALL SEARCH RESULTS
    if (PATTERNS.showAllResults(message) && searchCacheKey) {
      console.log(`📋 Show all results request for: ${searchCacheKey}`);
      
      const cachedSearch = searchCache.get(searchCacheKey);
      if (!cachedSearch) {
        return NextResponse.json({
          response: `❌ **Search Results Expired**: The search results are no longer available.

Please run your search again to get fresh results.`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const { results, searchTerm, searchType } = cachedSearch;
      
      if (searchType === 'courses') {
        const courseList = results.map((course: any, i: number) => {
          const courseName = api.getCourseName(course);
          const courseId = api.getCourseId(course);
          const status = course.status || course.course_status || 'Unknown';
          const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
          return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId}) - *${status}*`;
        }).join('\n');
        
        return NextResponse.json({
          response: `📚 **All Course Search Results**: "${searchTerm}" (${results.length} total)

${courseList}

💡 **Get Details**: "Course info [course name]" for detailed information`,
          success: true,
          totalCount: results.length,
          showingAll: true,
          timestamp: new Date().toISOString()
        });
      } else if (searchType === 'users') {
        const userList = results.map((user: any, i: number) => {
          const statusIcon = user.status === '1' ? '✅' : '❌';
          return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
        }).join('\n');
        
        return NextResponse.json({
          response: `👥 **All User Search Results**: "${searchTerm}" (${results.length} total)

${userList}

💡 **Get Details**: "User info [email]" or "Find user [email]" for detailed information`,
          success: true,
          totalCount: results.length,
          showingAll: true,
          timestamp: new Date().toISOString()
        });
      }
    }
    // 1. FLEXIBLE USER QUESTIONS (Check this first before other patterns)
    if (PATTERNS.userQuestion(message)) {
      console.log(`💬 User question detected: ${message}`);
      
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to answer questions about a user.

**Examples**: 
- "What is john@company.com's last login?"
- "When did sarah@test.com join?"
- "Is mike@company.com active?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const userDetails = await api.getUserDetails(email);
        const question = message.toLowerCase();
        
        let answer = '';
        
        if (question.includes('last login') || question.includes('last access')) {
          answer = `🔐 **Last Access**: ${userDetails.lastAccess}`;
        } else if (question.includes('when') && (question.includes('join') || question.includes('creat'))) {
          answer = `📅 **Account Created**: ${userDetails.creationDate}`;
        } else if (question.includes('status') || question.includes('active') || question.includes('inactive')) {
          answer = `📊 **Status**: ${userDetails.status}`;
        } else if (question.includes('level') || question.includes('role') || question.includes('permission')) {
          answer = `🏢 **Level**: ${userDetails.level}`;
        } else if (question.includes('branch') || question.includes('department')) {
          answer = `🏛️ **Branches**: ${userDetails.branches}\n🏛️ **Department**: ${userDetails.department}`;
        } else if (question.includes('group')) {
          answer = `👥 **Groups**: ${userDetails.groups}`;
        } else if (question.includes('language') || question.includes('timezone')) {
          answer = `🌍 **Language**: ${userDetails.language}\n🕐 **Timezone**: ${userDetails.timezone}`;
        } else if (question.includes('email') || question.includes('contact')) {
          answer = `📧 **Email**: ${userDetails.email}\n👤 **Username**: ${userDetails.username}`;
        } else {
          // General fallback - provide relevant info based on keywords
          answer = `👤 **${userDetails.fullname}** - Quick Info:
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}`;
        }
        
        return NextResponse.json({
          response: `💬 **Question About**: ${userDetails.fullname}

${answer}

💡 **More Questions**: 
- "What is ${email}'s status?"
- "When did ${email} last login?"
- "What level is ${email}?"
- "What groups is ${email} in?"`,
          success: true,
          userDetails: userDetails,
          questionAnswered: true,
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
    
    // 2. USER SEARCH (Enhanced with auto user details for email searches)
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
      
      // If searching by email, provide detailed info automatically
      if (email) {
        try {
          console.log(`📧 Email search detected: ${email} - Getting detailed user info`);
          
          const users = await api.searchUsers(searchTerm, 10);
          const userDetails = await api.getUserDetails(email);
          
          return NextResponse.json({
            response: `👥 **User Found**: ${userDetails.fullname}

## 📋 **Complete User Information**

### 👤 **Basic Details**
📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
🏛️ **Department**: ${userDetails.department}

### 🌍 **Preferences**
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}

### 📅 **Activity**
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}

### 👥 **Organization**
🏛️ **Branches**: ${userDetails.branches}
👥 **Groups**: ${userDetails.groups}

💡 **Admin Complete**: All available user information retrieved!
💬 **Ask More**: "What is ${userDetails.email}'s last login?" or "When did ${userDetails.email} join?"`,
            success: true,
            searchResults: users,
            userDetails: userDetails,
            autoDetailsFetched: true,
            timestamp: new Date().toISOString()
          });
          
        } catch (error) {
          // If detailed lookup fails, fall back to regular search
          console.log(`⚠️ Detailed lookup failed for ${email}, falling back to search results`);
          
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

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}

⚠️ **Note**: Could not retrieve detailed information for "${email}". ${error instanceof Error ? error.message : 'User may not exist.'}

💡 **Try**: "User info [exact_email]" for detailed information`,
            success: true,
            totalCount: users.length,
            detailsError: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        // Regular name-based search (no email detected)
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

${userList}${users.length > 20 ? `\n\n... and ${users.length - 20} more users` : ''}

💡 **Get Details**: "Find user [email]" or "User info [email]" for complete information`,
          success: true,
          totalCount: users.length,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    // 3. COURSE SEARCH  
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
        const status = course.status || course.course_status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
        return `${i + 1}. ${statusIcon} **${courseName}** (ID: ${courseId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Course Search Results**: Found ${courses.length} courses (Showing ${displayCount})

${courseList}${courses.length > 20 ? `\n\n... and ${courses.length - 20} more courses` : ''}

💡 **Get Details**: "Course info ${api.getCourseName(courses[0])}" for more information`,
        success: true,
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 4. USER DETAILS
    if (PATTERNS.getUserInfo(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to get user details.

**Example**: "User info john@company.com"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const userDetails = await api.getUserDetails(email);
        
        return NextResponse.json({
          response: `👤 **User Details**: ${userDetails.fullname}

📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
👤 **Username**: ${userDetails.username}
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
🏛️ **Department**: ${userDetails.department}
🌍 **Language**: ${userDetails.language}
🕐 **Timezone**: ${userDetails.timezone}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}
🏛️ **Branches**: ${userDetails.branches}
👥 **Groups**: ${userDetails.groups}`,
          success: true,
          data: userDetails,
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
    
    // 5. COURSE DETAILS
    if (PATTERNS.getCourseInfo(message)) {
      const courseName = course || message.replace(/course info|course details|tell me about course/gi, '').trim();
      
      if (!courseName || courseName.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Course Name**: I need a course name to get details.

**Example**: "Course info Python Programming"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const courseDetails = await api.getCourseDetails(courseName);
        
        return NextResponse.json({
          response: `📚 **Course Details**: ${courseDetails.name}

🆔 **Course ID**: ${courseDetails.id}
📝 **Code**: ${courseDetails.code}
📖 **Type**: ${courseDetails.type}
📊 **Status**: ${courseDetails.status}
🌍 **Language**: ${courseDetails.language}
🏆 **Credits**: ${courseDetails.credits}
⏱️ **Duration**: ${courseDetails.duration !== 'Not available' ? `${courseDetails.duration} minutes` : courseDetails.duration}
📂 **Category**: ${courseDetails.category}
👥 **Enrolled**: ${courseDetails.enrollments}
⭐ **Rating**: ${courseDetails.rating}
🏆 **Certificate**: ${courseDetails.certificate}
📅 **Created**: ${courseDetails.creationDate}
📝 **Last Updated**: ${courseDetails.modificationDate}

📋 **Description**: 
${courseDetails.description}`,
          success: true,
          data: courseDetails,
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
    
    // 5. FLEXIBLE USER QUESTIONS
    if (PATTERNS.userQuestion(message)) {
      if (!email) {
        return NextResponse.json({
          response: `❌ **Missing Email**: I need an email address to answer questions about a user.

**Examples**: 
- "What is john@company.com's last login?"
- "When did sarah@test.com join?"
- "Is mike@company.com active?"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      try {
        const userDetails = await api.getUserDetails(email);
        const question = message.toLowerCase();
        
        let answer = '';
        
        if (question.includes('last login') || question.includes('last access')) {
          answer = `🔐 **Last Access**: ${userDetails.lastAccess}`;
        } else if (question.includes('when') && (question.includes('join') || question.includes('creat'))) {
          answer = `📅 **Account Created**: ${userDetails.creationDate}`;
        } else if (question.includes('status') || question.includes('active') || question.includes('inactive')) {
          answer = `📊 **Status**: ${userDetails.status}`;
        } else if (question.includes('level') || question.includes('role') || question.includes('permission')) {
          answer = `🏢 **Level**: ${userDetails.level}`;
        } else if (question.includes('branch') || question.includes('department')) {
          answer = `🏛️ **Branches**: ${userDetails.branches}\n🏛️ **Department**: ${userDetails.department}`;
        } else if (question.includes('group')) {
          answer = `👥 **Groups**: ${userDetails.groups}`;
        } else if (question.includes('language') || question.includes('timezone')) {
          answer = `🌍 **Language**: ${userDetails.language}\n🕐 **Timezone**: ${userDetails.timezone}`;
        } else if (question.includes('email') || question.includes('contact')) {
          answer = `📧 **Email**: ${userDetails.email}\n👤 **Username**: ${userDetails.username}`;
        } else {
          // General fallback - provide relevant info based on keywords
          answer = `👤 **${userDetails.fullname}** - Quick Info:
📊 **Status**: ${userDetails.status}
🏢 **Level**: ${userDetails.level}
📅 **Created**: ${userDetails.creationDate}
🔐 **Last Access**: ${userDetails.lastAccess}`;
        }
        
        return NextResponse.json({
          response: `💬 **Question About**: ${userDetails.fullname}

${answer}

💡 **More Questions**: 
- "What is ${email}'s status?"
- "When did ${email} last login?"
- "What level is ${email}?"
- "What groups is ${email} in?"`,
          success: true,
          userDetails: userDetails,
          questionAnswered: true,
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
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Reliable & Fast*

I can help you with these **working features**:

• **👥 Find users**: "Find user mike@company.com"
  - **Email searches**: Get complete user details automatically
  - **Name searches**: Shows list of matching users
  - Smart detection: Email = full details, Name = search results

• **📖 Find courses**: "Find Python courses"
  - Search by course name or keyword
  - Shows up to 20 results

• **👤 User details**: "User info sarah@test.com"
  - Complete user profile information
  - Status, groups, branches, etc.

• **📚 Course details**: "Course info Python Programming"
  - Complete course information
  - Type, credits, duration, description

**Your message**: "${message}"

**Examples:**
- "Find user pulkitpmalhotra@gmail.com" *(Auto-details for emails)*
- "Find user mike" *(Search results for names)*
- "Find Python courses"
- "Course info Python Programming"

💡 **Admin Efficiency**: Email searches provide complete user info automatically!`,
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
    status: 'Reliable Docebo Chat API',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search (up to 50 results, show 20)',
      'Course search (up to 50 results, show 20)', 
      'User details lookup',
      'Course details lookup',
      'Fast & reliable (10-15 seconds)',
      'No enrollment complications'
    ],
    workingOperations: [
      'Find user [name/email]',
      'Find [keyword] courses',
      'User info [email]',
      'Course info [name]'
    ]
  });
}
