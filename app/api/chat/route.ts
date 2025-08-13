if (typeof source === 'string' && source.trim() && source !== 'null' && source !== 'undefined') {
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

    // Extract direct manager information with enhanced logic
    const extractManager = (): string => {
      // Check managers array first (most reliable)
      const managers = user.managers || mergedUser.managers || [];
      if (managers.length > 0) {
        // Find direct manager (type_id 1) or take first manager
        const directManager = managers.find((m: any) => m.manager_type_id === 1) || managers[0];
        if (directManager && directManager.manager_name) {
          console.log(`👔 Found direct manager from managers array:`, directManager.manager_name);
          return directManager.manager_name;
        }
      }
      
      // Check manager_names object
      const managerNames = user.manager_names || mergedUser.manager_names || {};
      if (managerNames['1'] && managerNames['1'].manager_name) {
        console.log(`👔 Found manager from manager_names object:`, managerNames['1'].manager_name);
        return managerNames['1'].manager_name;
      }
      
      // Check individual manager fields from detailed user data
      const managerFields = [
        mergedUser.manager_first_name && mergedUser.manager_last_name ? 
          `${mergedUser.manager_first_name} ${mergedUser.manager_last_name}` : null,
        mergedUser.manager_name,
        user.manager_name
      ].filter(Boolean);
      
      if (managerFields.length > 0) {
        console.log(`👔 Found manager from individual fields:`, managerFields[0]);
        return managerFields[0];
      }
      
      return 'Not assigned';
    };

    const branches = extractBranches();
    const groups = extractGroups();
    const manager = extractManager();

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
      manager: manager,
      
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
        managerApiCalled: managerDetails ? 'Success' : 'Failed',
        alternativeGroupsApiCalled: alternativeGroups ? 'Success' : 'Failed',
        branchListApiCalled: branchListDetails ? 'Success' : 'Failed',
        allBranchesApiCalled: allBranches ? 'Success' : 'Failed',
        rawBranchData: branchDetails?.data || null,
        rawGroupData: groupDetails?.data || null,
        rawOrgData: userOrgDetails?.data || null,
        rawManagerData: managerDetails?.data || null,
        rawAlternativeGroups: alternativeGroups?.data || null,
        rawBranchList: branchListDetails?.data || null,
        // Show fields that might contain branch/manager info
        branchFields: Object.keys(user).filter(k => k.toLowerCase().includes('branch')),
        managerFields: Object.keys(user).filter(k => k.toLowerCase().includes('manager') || k.toLowerCase().includes('supervisor')),
        userFieldSample: Object.fromEntries(
          Object.entries(user).slice(0, 10).map(([k, v]) => [k, typeof v === 'object' ? '[object]' : v])
        )
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
            // Handle object values (like category or user objects)
            if (typeof value === 'object' && value.name) {
              return String(value.name);
            }
            if (typeof value === 'object' && value.title) {
              return String(value.title);
            }
            if (typeof value === 'object' && value.fullname) {
              return String(value.fullname);
            }
            if (typeof value === 'object' && value.username) {
              return String(value.username);
            }
            if (typeof value === 'object' && value.id) {
              // For user objects, try to get name or fallback to ID
              const userName = value.fullname || value.name || value.username || `User ID: ${value.id}`;
              return String(userName);
            }
            if (typeof value === 'object') {
              // Try to extract meaningful info from object
              const objStr = JSON.stringify(value);
              if (objStr.includes('fullname')) {
                try {
                  const parsed = JSON.parse(objStr);
                  return parsed.fullname || parsed.name || parsed.username || objStr;
                } catch {
                  return objStr;
                }
              }
              return objStr;
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
      createdBy: extractField('created_by', ['creator', 'author', 'created_by_name', 'creator_name', 'created_by_username', 'author_name', 'instructor']),
      lastUpdatedBy: extractField('updated_by', ['modified_by', 'last_updated_by', 'updated_by_name', 'modified_by_name', 'last_modified_by', 'updated_by_username']),
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

  getLearningPlanId(lp: any): number | null {
    return lp.id || lp.learning_plan_id || lp.idLearningPlan || null;
  }

  getLearningPlanName(lp: any): string {
    return lp.title || lp.name || lp.learning_plan_name || 'Unknown Learning Plan';
  }

  getSessionId(session: any): number | null {
    return session.id || session.session_id || null;
  }

  getSessionName(session: any): string {
    return session.name || session.session_name || session.title || 'Unknown Session';
  }

  getMaterialId(material: any): number | null {
    return material.id || material.material_id || null;
  }

  getMaterialName(material: any): string {
    return material.title || material.name || material.material_name || 'Unknown Material';
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
    const learningPlan = extractLearningPlan(message);
    const session = extractSession(message);
    const trainingMaterial = extractTrainingMaterial(message);
    const searchCacheKey = extractSearchCacheKey(message);
    
    console.log(`📋 Parsed - Email: ${email}, Course: ${course}, LP: ${learningPlan}, Session: ${session}, Material: ${trainingMaterial}, SearchCache: ${searchCacheKey}`);
    console.log(`🔍 Pattern matching - userQuestion: ${PATTERNS.userQuestion(message)}, searchUsers: ${PATTERNS.searchUsers(message)}, showAllResults: ${PATTERNS.showAllResults(message)}`);
    
    // 1. DOCEBO HELP AND FUNCTIONALITY
    if (PATTERNS.doceboHelp(message)) {
      console.log(`📖 Docebo help request detected: ${message}`);
      
      try {
        const helpResponse = await api.getDoceboHelpResponse(message);
        
        return NextResponse.json({
          response: helpResponse,
          success: true,
          helpRequest: true,
          query: message,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        return NextResponse.json({
          response: `📖 **Docebo Help Available**

I can help you with Docebo functionality questions! 

**Try asking:**
• "How to enroll users in Docebo"
• "How to create courses" 
• "How to set up learning plans"
• "How to configure notifications"
• "How to manage user branches"

📖 **Official Documentation**: https://help.docebo.com/hc/en-us

For specific technical questions, please visit the Docebo Help Center for the most up-to-date information.`,
          success: true,
          helpRequest: true,
          timestamp: new Date().toISOString()
        });
      }
    }

    // 2. SHOW ALL SEARCH RESULTS
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
        response: `📚 **Course Search Results**: Found ${courses.length} courses (Showing ${displayCount})

${courseList}${courses.length > 20 ? `\n\n... and ${courses.length - 20} more courses` : ''}

💡 **Get Details**: "Course info ${api.getCourseName(courses[0])}" for more information`,
        success: true,
        totalCount: courses.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 6. LEARNING PLAN SEARCH
    if (PATTERNS.searchLearningPlans(message)) {
      const searchTerm = learningPlan || message.replace(/find|search|learning plan|lp/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a learning plan name to search for.

**Example**: "Find Python learning plans"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const learningPlans = await api.searchLearningPlans(searchTerm, 50);
      
      if (learningPlans.length === 0) {
        return NextResponse.json({
          response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(learningPlans.length, 20);
      const lpList = learningPlans.slice(0, displayCount).map((lp, i) => {
        const lpName = api.getLearningPlanName(lp);
        const lpId = api.getLearningPlanId(lp);
        const status = lp.status || lp.learning_plan_status || 'Unknown';
        const statusIcon = status === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
        return `${i + 1}. ${statusIcon} **${lpName}** (ID: ${lpId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans (Showing ${displayCount})

${lpList}${learningPlans.length > 20 ? `\n\n... and ${learningPlans.length - 20} more learning plans` : ''}

💡 **Get Details**: "Learning plan info ${api.getLearningPlanName(learningPlans[0])}" for more information`,
        success: true,
        totalCount: learningPlans.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 7. SESSION SEARCH
    if (PATTERNS.searchSessions(message)) {
      const searchTerm = session || message.replace(/find|search|session/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a session name to search for.

**Example**: "Find Python sessions"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const sessions = await api.searchSessions(searchTerm, 50);
      
      if (sessions.length === 0) {
        return NextResponse.json({
          response: `🎯 **No Sessions Found**: No sessions match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(sessions.length, 20);
      const sessionList = sessions.slice(0, displayCount).map((sess, i) => {
        const sessName = api.getSessionName(sess);
        const sessId = api.getSessionId(sess);
        const status = sess.status || sess.session_status || 'Unknown';
        const statusIcon = status === 'active' ? '✅' : status === 'cancelled' ? '❌' : status === 'completed' ? '🏁' : '❓';
        return `${i + 1}. ${statusIcon} **${sessName}** (ID: ${sessId}) - *${status}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `🎯 **Session Search Results**: Found ${sessions.length} sessions (Showing ${displayCount})

${sessionList}${sessions.length > 20 ? `\n\n... and ${sessions.length - 20} more sessions` : ''}

💡 **Get Details**: "Session info ${api.getSessionName(sessions[0])}" for more information`,
        success: true,
        totalCount: sessions.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 8. TRAINING MATERIAL SEARCH
    if (PATTERNS.searchTrainingMaterials(message)) {
      const searchTerm = trainingMaterial || message.replace(/find|search|training material|material/gi, '').trim();
      
      if (!searchTerm || searchTerm.length < 2) {
        return NextResponse.json({
          response: `❌ **Missing Search Term**: I need a material name to search for.

**Example**: "Find Python training materials"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const materials = await api.searchTrainingMaterials(searchTerm, 50);
      
      if (materials.length === 0) {
        return NextResponse.json({
          response: `📄 **No Training Materials Found**: No materials match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const displayCount = Math.min(materials.length, 20);
      const materialList = materials.slice(0, displayCount).map((mat, i) => {
        const matName = api.getMaterialName(mat);
        const matId = api.getMaterialId(mat);
        const type = mat.type || mat.material_type || 'Unknown';
        const typeIcon = type === 'video' ? '🎥' : type === 'document' ? '📄' : type === 'audio' ? '🎵' : '📁';
        return `${i + 1}. ${typeIcon} **${matName}** (ID: ${matId}) - *${type}*`;
      }).join('\n');
      
      return NextResponse.json({
        response: `📄 **Training Material Search Results**: Found ${materials.length} materials (Showing ${displayCount})

${materialList}${materials.length > 20 ? `\n\n... and ${materials.length - 20} more materials` : ''}

💡 **Get Details**: "Material info ${api.getMaterialName(materials[0])}" for more information`,
        success: true,
        totalCount: materials.length,
        timestamp: new Date().toISOString()
      });
    }
    
    // 9. USER DETAILS
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
👥 **Groups**: ${userDetails.groups}
👔 **Manager**: ${userDetails.manager}`,
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
    
    // 10. COURSE DETAILS
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
👤 **Created By**: ${courseDetails.createdBy}
📝 **Last Updated**: ${courseDetails.modificationDate}
👤 **Last Updated By**: ${courseDetails.lastUpdatedBy}

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
    
    // FALLBACK: Help message
    return NextResponse.json({
      response: `🎯 **Docebo Assistant** - *Comprehensive Learning Management*

I can help you with these **working features**:

## 👥 **Users**
• **Find users**: "Find user mike@company.com"
  - **Email searches**: Get complete user details automatically
  - **Name searches**: Shows list of matching users
• **User details**: "User info sarah@test.com"
  - Complete profile, status, manager, organization

## 📚 **Courses**
• **Find courses**: "Find Python courses"
• **Course details**: "Course info Python Programming"
  - Complete course information with creator details

## 📚 **Learning Plans**
• **Find learning plans**: "Find Python learning plans"
• **Learning plan details**: "Learning plan info Python Fundamentals"
  - Complete learning path information

## 🎯 **Sessions**
• **Find sessions**: "Find Python sessions"  
• **Session details**: "Session info Python Workshop"
  - Instructor, schedule, location details

## 📄 **Training Materials**
• **Find materials**: "Find Python training materials"
• **Material details**: "Material info Python Guide"
  - File details, format, downloads

## 📖 **Docebo Help & Guidance**
• **How-to questions**: "How to enroll users in Docebo"
• **Feature explanations**: "What is a learning plan in Docebo"
• **Configuration help**: "How to set up notifications"
• **Best practices**: "How to organize users in branches"
• **Troubleshooting**: "How to fix enrollment issues"

**Your message**: "${message}"

**Examples:**
- "Find user pulkitmalhotra@gmail.com"
- "Course info Release Course Testing"
- "How to create courses in Docebo"
- "How to set up user branches"
- "What are learning plans in Docebo"

💡 **Smart Help**: Ask about any Docebo feature and get official guidance!`,
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
    status: 'Comprehensive Docebo Chat API',
    version: '2.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'User search and details',
      'Course search and details', 
      'Learning plan search and details',
      'Session search and details',
      'Training material search and details',
      'Docebo help and guidance',
      'Natural language processing',
      'Role-based functionality'
    ],
    workingOperations: [
      'Find user [name/email]',
      'Find [keyword] courses',
      'Find [keyword] learning plans',
      'Find [keyword] sessions',
      'Find [keyword] training materials',
      'User info [email]',
      'Course info [name]',
      'How to [docebo functionality]'
    ]
  });
} === 'published' ? '✅' : status === 'draft' ? '📝' : status === 'archived' ? '📦' : '❓';
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
    
    // 3. FLEXIBLE USER QUESTIONS (Check this first before other patterns)
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
        } else if (question.includes('manager') || question.includes('supervisor') || question.includes('reports to')) {
          answer = `👔 **Manager**: ${userDetails.manager}`;
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
    
    // 4. USER SEARCH (Enhanced with auto user details for email searches)
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
👔 **Manager**: ${userDetails.manager}

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
    
    // 5. COURSE SEARCH  
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
        const statusIcon = status// app/api/chat/route.ts - Clean & Reliable - Working Features Only
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
           !lower.includes('course') && !lower.includes('learning plan') && 
           !lower.includes('session') && !lower.includes('training material');
  },
  searchCourses: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('course')) ||
           (lower.includes('search') && lower.includes('course'));
  },
  searchLearningPlans: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && (lower.includes('learning plan') || lower.includes('lp'))) ||
           (lower.includes('search') && (lower.includes('learning plan') || lower.includes('lp')));
  },
  searchSessions: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && lower.includes('session')) ||
           (lower.includes('search') && lower.includes('session'));
  },
  searchTrainingMaterials: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('find') && (lower.includes('training material') || lower.includes('material'))) ||
           (lower.includes('search') && (lower.includes('training material') || lower.includes('material')));
  },
  doceboHelp: (msg: string) => {
    const lower = msg.toLowerCase();
    return (
      // Direct help requests
      lower.includes('how to') || lower.includes('how do i') || lower.includes('how does') ||
      // Feature questions
      lower.includes('what is') && (lower.includes('docebo') || lower.includes('feature')) ||
      // Configuration questions
      lower.includes('configure') || lower.includes('setup') || lower.includes('enable') ||
      // Functionality questions
      lower.includes('functionality') || lower.includes('feature') || lower.includes('capability') ||
      // Help keywords
      lower.includes('help') || lower.includes('guide') || lower.includes('tutorial') ||
      lower.includes('documentation') || lower.includes('manual') ||
      // Process questions
      lower.includes('process') || lower.includes('workflow') || lower.includes('steps') ||
      // Troubleshooting
      lower.includes('troubleshoot') || lower.includes('problem') || lower.includes('issue') ||
      lower.includes('error') || lower.includes('not working') ||
      // Best practices
      lower.includes('best practice') || lower.includes('recommendation') ||
      // Admin questions
      lower.includes('admin') || lower.includes('administration') || lower.includes('manage') ||
      // Specific Docebo features
      lower.includes('branch') || lower.includes('catalog') || lower.includes('certification') ||
      lower.includes('notification') || lower.includes('report') || lower.includes('analytics') ||
      lower.includes('enrollment') || lower.includes('completion') || lower.includes('assessment')
    ) && !lower.includes('find user') && !lower.includes('search user') && 
         !lower.includes('user info') && !lower.includes('course info');
  },
  getUserInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('user info') || lower.includes('user details') || 
            lower.includes('tell me about user')) && !lower.includes('course') &&
            !lower.includes('learning plan') && !lower.includes('session') && 
            !lower.includes('training material');
  },
  getCourseInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('course info') || lower.includes('course details') || 
            lower.includes('tell me about course'));
  },
  getLearningPlanInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('learning plan info') || lower.includes('lp info') || 
            lower.includes('learning plan details') || lower.includes('lp details') ||
            lower.includes('tell me about learning plan'));
  },
  getSessionInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('session info') || lower.includes('session details') || 
            lower.includes('tell me about session'));
  },
  getTrainingMaterialInfo: (msg: string) => {
    const lower = msg.toLowerCase();
    return (lower.includes('material info') || lower.includes('training material info') || 
            lower.includes('material details') || lower.includes('training material details') ||
            lower.includes('tell me about material') || lower.includes('tell me about training material'));
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
            lower.includes('all courses') || lower.includes('all users') ||
            lower.includes('all learning plans') || lower.includes('all sessions') ||
            lower.includes('all materials')) &&
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

function extractCourse(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches (for course names in brackets)
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "course info" pattern
  const courseInfoMatch = message.match(/course info\s+(.+)/i);
  if (courseInfoMatch) return courseInfoMatch[1].trim();
  
  // Try "find" pattern
  const courseMatch = message.match(/find\s+(.+?)\s+course/i);
  if (courseMatch) return courseMatch[1].trim();
  
  return null;
}

function extractLearningPlan(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "learning plan info" pattern
  const lpInfoMatch = message.match(/(?:learning plan info|lp info)\s+(.+)/i);
  if (lpInfoMatch) return lpInfoMatch[1].trim();
  
  // Try "find" pattern
  const lpMatch = message.match(/find\s+(.+?)\s+(?:learning plan|lp)/i);
  if (lpMatch) return lpMatch[1].trim();
  
  return null;
}

function extractSession(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "session info" pattern
  const sessionInfoMatch = message.match(/session info\s+(.+)/i);
  if (sessionInfoMatch) return sessionInfoMatch[1].trim();
  
  // Try "find" pattern
  const sessionMatch = message.match(/find\s+(.+?)\s+session/i);
  if (sessionMatch) return sessionMatch[1].trim();
  
  return null;
}

function extractTrainingMaterial(message: string): string | null {
  // First try quoted matches
  const quotedMatch = message.match(/"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  
  // Try bracketed matches
  const bracketMatch = message.match(/\[([^\]]+)\]/);
  if (bracketMatch) return bracketMatch[1];
  
  // Try "material info" pattern
  const materialInfoMatch = message.match(/(?:material info|training material info)\s+(.+)/i);
  if (materialInfoMatch) return materialInfoMatch[1].trim();
  
  // Try "find" pattern
  const materialMatch = message.match(/find\s+(.+?)\s+(?:material|training material)/i);
  if (materialMatch) return materialMatch[1].trim();
  
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

  async searchLearningPlans(searchText: string, limit: number = 20): Promise<any[]> {
    const result = await this.apiRequest('/learn/v1/learningplans', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchSessions(searchText: string, limit: number = 20): Promise<any[]> {
    // Try multiple endpoints for sessions
    const endpoints = [
      '/course/v1/sessions',
      '/learn/v1/sessions',
      '/manage/v1/sessions'
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        if (result.data?.items?.length > 0) {
          return result.data.items;
        }
      } catch (error) {
        console.log(`⚠️ Session endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    return [];
  }

  async searchTrainingMaterials(searchText: string, limit: number = 20): Promise<any[]> {
    // Try multiple endpoints for training materials
    const endpoints = [
      '/learn/v1/materials',
      '/course/v1/materials',
      '/manage/v1/materials',
      '/learn/v1/lo'  // Learning Objects
    ];
    
    for (const endpoint of endpoints) {
      try {
        const result = await this.apiRequest(endpoint, {
          search_text: searchText,
          page_size: Math.min(limit, 200)
        });
        if (result.data?.items?.length > 0) {
          return result.data.items;
        }
      } catch (error) {
        console.log(`⚠️ Training material endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    return [];
  }

  async getDoceboHelpResponse(query: string): Promise<string> {
    console.log(`📖 Generating help response for: ${query}`);
    
    // Create a helpful response with common Docebo information
    const commonAnswers: Record<string, string> = {
      'user management': `**User Management in Docebo:**
      
• **Adding Users**: Go to Admin Menu > User Management > Users > Add User
• **Bulk Import**: Use CSV import for multiple users via Admin Menu > User Management > Users > Import
• **User Levels**: Set appropriate permissions (Superadmin, Power User, User Manager, User)
• **Branches**: Organize users into branches for better management
• **Groups**: Create dynamic or manual groups for targeted training

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'enrollment': `**Enrollment Management:**
      
• **Manual Enrollment**: Select users and assign courses directly
• **Automatic Enrollment**: Use enrollment rules based on user attributes
• **Self-Enrollment**: Enable catalog visibility for user self-service
• **Bulk Enrollment**: Use CSV import or group enrollment
• **Enrollment Status**: Track enrolled, in progress, completed, suspended

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'course creation': `**Course Creation Process:**
      
• **Course Types**: Choose from E-learning, ILT (Instructor-Led), Blended
• **Content Upload**: Add SCORM packages, videos, documents, assessments
• **Course Settings**: Configure completion criteria, time limits, attempts
• **Publishing**: Set course status and catalog visibility
• **Tracking**: Enable progress tracking and completion certificates

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'learning plan': `**Learning Plans:**
      
• **Structure**: Combine multiple courses in a learning path
• **Prerequisites**: Set course dependencies and completion order
• **Completion Rules**: Define how learners complete the plan
• **Assignments**: Assign to users, groups, or branches
• **Tracking**: Monitor progress across the entire learning path

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'reporting': `**Reporting and Analytics:**
      
• **Standard Reports**: Access pre-built reports for users, courses, learning plans
• **Custom Reports**: Create tailored reports with specific filters
• **Scheduled Reports**: Automate report delivery via email
• **Dashboard**: View real-time analytics and KPIs
• **Export Options**: Download data in CSV, PDF, or Excel formats

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'notification': `**Notifications and Messaging:**
      
• **Automatic Notifications**: Set up email alerts for enrollments, completions, deadlines
• **Custom Messages**: Create personalized communication templates
• **Digest Settings**: Configure notification frequency and batching
• **Message Center**: Use internal messaging system
• **SMS Integration**: Enable text message notifications (if configured)

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'api': `**API and SSO Setup:**
      
• **API Access**: Enable API access in Admin Menu > System Settings > API & SSO
• **API Keys**: Generate client ID and secret for authentication
• **OAuth 2.0**: Use standard OAuth flow for secure API access
• **SSO Configuration**: Set up SAML or other SSO protocols
• **Permissions**: Configure API permissions and user mapping

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`,

      'branch': `**Branch Configuration:**
      
• **Creating Branches**: Go to Admin Menu > User Management > Branches
• **Branch Hierarchy**: Set up parent/child branch relationships
• **User Assignment**: Assign users to branches automatically or manually
• **Branch Permissions**: Configure what branch managers can see/do
• **Reporting**: Generate branch-specific reports and analytics

📖 **Detailed Guide**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}`
    };

    // Find the most relevant answer
    const queryLower = query.toLowerCase();
    for (const [topic, answer] of Object.entries(commonAnswers)) {
      if (queryLower.includes(topic.replace(' ', '')) || queryLower.includes(topic)) {
        return answer;
      }
    }

    // Generic help response
    return `**Docebo Help for "${query}"**

I can help you with Docebo functionality questions!

**Common Docebo Topics:**
• User management and enrollment
• Course creation and management
• Learning plan configuration
• Reporting and analytics
• Notifications and messaging
• Branch and organization setup
• API and SSO configuration
• Catalog and course catalog
• Certifications and completion tracking

📖 **Official Documentation**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

💡 **Need Specific Help?** Try asking:
• "How to enroll users in Docebo"
• "How to create a course in Docebo"  
• "How to set up learning plans"
• "How to configure notifications"
• "How to generate reports"`;
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
    
    // **DEBUG MODE** - Log all user fields that might contain branch/manager info
    const debugFields = {
      allFields: Object.keys(user),
      branchFields: Object.keys(user).filter(k => k.toLowerCase().includes('branch') || k.toLowerCase().includes('office') || k.toLowerCase().includes('location')),
      managerFields: Object.keys(user).filter(k => k.toLowerCase().includes('manager') || k.toLowerCase().includes('supervisor') || k.toLowerCase().includes('report')),
      potentialBranchValues: {} as Record<string, any>,
      potentialManagerValues: {} as Record<string, any>
    };
    
    // Extract potential branch values
    debugFields.branchFields.forEach(field => {
      debugFields.potentialBranchValues[field] = (user as any)[field];
    });
    
    // Extract potential manager values  
    debugFields.managerFields.forEach(field => {
      debugFields.potentialManagerValues[field] = (user as any)[field];
    });
    
    console.log(`🔍 DEBUG FIELDS ANALYSIS:`, JSON.stringify(debugFields, null, 2));

    // Try multiple API endpoints to get complete user data
    let additionalDetails = null;
    let branchDetails = null;
    let groupDetails = null;
    let userOrgDetails = null;
    let managerDetails = null;
    let branchListDetails = null;

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

    // Try alternative branches endpoint
    try {
      branchListDetails = await this.apiRequest('/manage/v1/branches', {
        user_id: user.user_id
      });
      console.log(`🏛️ Alternative branches endpoint:`, JSON.stringify(branchListDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Alternative branches endpoint failed:`, error);
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

    // Try manager/supervisor endpoint
    try {
      managerDetails = await this.apiRequest(`/manage/v1/user/${user.user_id}/manager`);
      console.log(`👔 Manager endpoint:`, JSON.stringify(managerDetails, null, 2));
    } catch (error) {
      console.log(`⚠️ Manager endpoint failed:`, error);
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

    // Try to get all branches and filter by user
    let allBranches = null;
    try {
      allBranches = await this.apiRequest('/manage/v1/branches');
      console.log(`🏛️ All branches endpoint:`, JSON.stringify(allBranches, null, 2));
    } catch (error) {
      console.log(`⚠️ All branches endpoint failed:`, error);
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

    // Extract branches from all possible sources with enhanced logic
    const extractBranches = (): string => {
      // Check if branches array exists and has data
      const branches = mergedUser.branches || user.branches || [];
      if (branches.length > 0) {
        const branchNames = branches.map((b: any) => b.name || b.branch_name || b.title || JSON.stringify(b)).join(', ');
        console.log(`🏛️ Found branches from branches array:`, branchNames);
        return branchNames;
      }
      
      // Check custom fields for organizational information
      const additionalFields = mergedUser.additional_fields || [];
      const orgFields = [];
      
      // Look for organization-related fields
      for (const field of additionalFields) {
        if (field.title === 'Organization Name' && field.value) {
          orgFields.push(`Organization: ${field.value}`);
        }
        if (field.title === 'Team' && field.value) {
          orgFields.push(`Team: ${field.value}`);
        }
        if (field.title === 'Job Role' && field.value) {
          orgFields.push(`Role: ${field.value}`);
        }
      }
      
      if (orgFields.length > 0) {
        const orgInfo = orgFields.join(' | ');
        console.log(`🏛️ Found organizational info from custom fields:`, orgInfo);
        return orgInfo;
      }
      
      // Fallback to direct field values if custom fields not available
      const fallbackFields = [
        user.field_4, // Organization Name (GBO)
        user.field_5, // Team (Go to Market Operations)
        user.field_1  // Job Role
      ].filter(Boolean);
      
      if (fallbackFields.length > 0) {
        const fallbackInfo = fallbackFields.join(' | ');
        console.log(`🏛️ Found organizational info from direct fields:`, fallbackInfo);
        return fallbackInfo;
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
            if (result && result !== 'null' && result !== 'undefined') return result;
          }
          if (source && typeof source === 'object' && !Array.isArray(source)) {
            const result = source.name || source.group_name || source.title || JSON.stringify(source);
            console.log(`👥 Found groups from object:`, result);
            if (result && result !== 'null' && result !== 'undefined') return result;
          }
          if (typeof source === 'string' && source.
