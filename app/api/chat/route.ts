const result = await this.apiRequest(endpoint);
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} course enrollments from ${endpoint}`);
          
          const userEnrollments = result.data.items.filter((enrollment: any) => {
            return enrollment.user_id?.toString() === userId.toString() || 
                   enrollment.id_user?.toString() === userId.toString();
          });
          
         return {
  enrollments: userEnrollments,
  totalCount: userEnrollments.length,
  endpoint: endpoint,
  success: true
};
        }
catch (error) {
        console.log(`❌ Course enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false
    };
  }

  async getUserLearningPlanEnrollments(userId: string): Promise<any> {
    console.log(`📋 Getting learning plan enrollments for user: ${userId}`);
    
    const endpoints = [
      `/learningplan/v1/learningplans/enrollments?user_id=${userId}`,
      `/learningplan/v1/learningplans/enrollments?id_user=${userId}`,
      `/learn/v1/enrollments/learningplans?user_id=${userId}`,
      `/learn/v1/enrollments/learningplans?id_user=${userId}`,
      `/manage/v1/user/${userId}/learningplans`,
      `/learn/v1/users/${userId}/learningplans`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying learning plan enrollment endpoint: ${endpoint}`);
        const result = await this.apiRequest(endpoint);
        
        if (result.data?.items?.length > 0) {
          console.log(`✅ Found ${result.data.items.length} learning plan enrollments from ${endpoint}`);
          
          const userEnrollments = result.data.items.filter((enrollment: any) => {
            const enrollmentUserId = enrollment.user_id || enrollment.id_user || enrollment.userId;
            return enrollmentUserId?.toString() === userId.toString();
          });
          
          return {
            enrollments: userEnrollments.length > 0 ? userEnrollments : result.data.items,
            totalCount: userEnrollments.length > 0 ? userEnrollments.length : result.data.items.length,
            endpoint: endpoint,
            success: true
          };
        } else if (result.data && Array.isArray(result.data) && result.data.length > 0) {
          console.log(`✅ Found ${result.data.length} learning plan enrollments from ${endpoint} (direct array)`);
          return {
            enrollments: result.data,
            totalCount: result.data.length,
            endpoint: endpoint,
            success: true
          };
        }
      } catch (error) {
        console.log(`❌ Learning plan enrollment endpoint ${endpoint} failed:`, error);
        continue;
      }
    }
    
    return {
      enrollments: [],
      totalCount: 0,
      endpoint: 'none_available',
      success: false
    };
  }

  async getUserAllEnrollments(userId: string): Promise<any> {
    console.log(`🎯 Getting all enrollments for user: ${userId}`);
    
    try {
      const [courseResult, learningPlanResult] = await Promise.all([
        this.getUserCourseEnrollments(userId),
        this.getUserLearningPlanEnrollments(userId)
      ]);
      
      return {
        courses: courseResult,
        learningPlans: learningPlanResult,
        totalCourses: courseResult.totalCount,
        totalLearningPlans: learningPlanResult.totalCount,
        success: courseResult.success || learningPlanResult.success
      };
    } catch (error) {
      console.error(`❌ Error getting all enrollments for user ${userId}:`, error);
      return {
        courses: { enrollments: [], totalCount: 0, success: false },
        learningPlans: { enrollments: [], totalCount: 0, success: false },
        totalCourses: 0,
        totalLearningPlans: 0,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  formatCourseEnrollment(enrollment: any): any {
    const formatted = {
      courseId: enrollment.course_id || enrollment.id_course || enrollment.idCourse,
      courseName: enrollment.course_name || enrollment.name || enrollment.title || 'Unknown Course',
      enrollmentStatus: enrollment.status || enrollment.enrollment_status || enrollment.state || 'Unknown',
      enrollmentDate: enrollment.enroll_date_of_enrollment || 
                     enrollment.enroll_begin_date || 
                     enrollment.enrollment_date || 
                     enrollment.enrollment_created_at || 
                     enrollment.date_enrolled || 
                     enrollment.created_at,
      completionDate: enrollment.course_complete_date || 
                     enrollment.date_complete || 
                     enrollment.enrollment_completion_date || 
                     enrollment.completion_date || 
                     enrollment.completed_at || 
                     enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || enrollment.percentage || 0,
      score: enrollment.score || enrollment.final_score || enrollment.grade || null,
      dueDate: enrollment.enroll_end_date || 
               enrollment.soft_deadline ||
               enrollment.course_end_date ||
               enrollment.enrollment_validity_end_date || 
               enrollment.active_until || 
               enrollment.due_date || 
               enrollment.deadline,
      assignmentType: enrollment.assignment_type || 
                     enrollment.type || 
                     enrollment.enrollment_type ||
                     enrollment.assign_type
    };
    
    return formatted;
  }

  formatLearningPlanEnrollment(enrollment: any): any {
    let enrollmentStatus = 'Unknown';
    if (enrollment.status !== undefined && enrollment.status !== null) {
      switch (parseInt(enrollment.status)) {
        case -1:
          enrollmentStatus = 'waiting_for_payment';
          break;
        case 0:
          enrollmentStatus = 'enrolled';
          break;
        case 1:
          enrollmentStatus = 'in_progress';
          break;
        case 2:
          enrollmentStatus = 'completed';
          break;
        default:
          enrollmentStatus = enrollment.status || enrollment.enrollment_status || enrollment.state || 'Unknown';
      }
    } else {
      enrollmentStatus = enrollment.enrollment_status || enrollment.state || enrollment.lp_status || 'Unknown';
    }
    
    const formatted = {
      learningPlanId: enrollment.learning_plan_id || enrollment.id_learning_plan || enrollment.lp_id,
      learningPlanName: enrollment.learning_plan_name || 
                       enrollment.name || 
                       enrollment.title ||
                       enrollment.lp_name ||
                       'Unknown Learning Plan',
      enrollmentStatus: enrollmentStatus,
      enrollmentDate: enrollment.enroll_date_of_enrollment || 
                     enrollment.enroll_begin_date || 
                     enrollment.enrollment_date || 
                     enrollment.enrollment_created_at || 
                     enrollment.date_enrolled || 
                     enrollment.created_at,
      completionDate: enrollment.course_complete_date || 
                     enrollment.date_complete || 
                     enrollment.enrollment_completion_date || 
                     enrollment.completion_date || 
                     enrollment.completed_at || 
                     enrollment.date_completed,
      progress: enrollment.progress || enrollment.completion_percentage || enrollment.percentage || 0,
      completedCourses: enrollment.completed_courses || enrollment.courses_completed || 0,
      totalCourses: enrollment.total_courses || enrollment.courses_total || 0,
      dueDate: enrollment.enroll_end_date || 
               enrollment.soft_deadline ||
               enrollment.course_end_date ||
               enrollment.enrollment_validity_end_date || 
               enrollment.active_until || 
               enrollment.due_date || 
               enrollment.deadline,
      assignmentType: enrollment.assignment_type || 
                     enrollment.type || 
                     enrollment.enrollment_type ||
                     enrollment.assign_type
    };
    
    return formatted;
  }

  getCourseName(course: any): string {
    return course.title || course.course_name || course.name || 'Unknown Course';
  }

  getLearningPlanName(lp: any): string {
    return lp.title || 
           lp.name || 
           lp.learning_plan_name || 
           lp.lp_name || 
           lp.learningplan_name ||
           lp.plan_name ||
           'Unknown Learning Plan';
  }
}

let api: DoceboAPI;

// NEW: Enrollment Management Handler Functions
// Add these NEW handler functions for enrollment management

async function handleEnrollUserInCourse(entities: any) {
  const { email, courseName } = entities;
  
  if (!email || !courseName) {
    return NextResponse.json({
      response: `❌ **Missing Information**: I need both a user email and course name to enroll.

**Examples:**
- "Enroll john@company.com in course Python Programming"
- "Add sarah@company.com to Excel Training"
- "Register mike@company.com for Leadership Development"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  console.log(`📚 Enrolling ${email} in course "${courseName}"`);
  
  try {
    // Find user
    const userDetails = await api.getUserDetails(email);
    const userId = userDetails.id;
    
    // Find course
    const course = await api.findCourseByIdentifier(courseName);
    const courseId = course.id || course.course_id;
    const courseDisplayName = api.getCourseName(course);
    
    // Check if already enrolled
    const existingEnrollments = await api.getUserCourseEnrollments(userId);
    const alreadyEnrolled = existingEnrollments.enrollments.some((enrollment: any) => {
      const enrollmentCourseId = enrollment.course_id || enrollment.id_course;
      return enrollmentCourseId?.toString() === courseId.toString();
    });
    
    if (alreadyEnrolled) {
      return NextResponse.json({
        response: `ℹ️ **Already Enrolled**

👤 **User**: ${userDetails.fullname} (${email})
📚 **Course**: ${courseDisplayName}

✅ ${userDetails.fullname.split(' ')[0]} is already enrolled in this course.

**What you can do:**
- Check enrollment status: "Check if ${email} is enrolled in course ${courseDisplayName}"
- View all enrollments: "User enrollments ${email}"`,
        success: true,
        data: { alreadyEnrolled: true },
        timestamp: new Date().toISOString()
      });
    }
    
    // Perform enrollment
    const enrollmentResult = await api.enrollUserInCourse(userId, courseId, {
      assignmentType: 'required',
      level: 'student'
    });
    
    return NextResponse.json({
      response: `✅ **Enrollment Successful**

👤 **User**: ${userDetails.fullname} (${email})
📚 **Course**: ${courseDisplayName}
🆔 **Course ID**: ${courseId}

🎉 **${userDetails.fullname.split(' ')[0]} has been successfully enrolled!**

**Next Steps:**
- Check enrollment: "Check if ${email} is enrolled in course ${courseDisplayName}"
- View all enrollments: "User enrollments ${email}"`,
      success: true,
      data: {
        enrolled: true,
        userInfo: userDetails,
        courseInfo: { id: courseId, name: courseDisplayName },
        enrollmentResult: enrollmentResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Course enrollment error:', error);
    return NextResponse.json({
      response: `❌ **Enrollment Failed**

**User**: ${email}
**Course**: "${courseName}"

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}

**Try:**
- Check user exists: "Find user ${email}"
- Search for course: "Find ${courseName} courses"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleEnrollUserInLearningPlan(entities: any) {
  const { email, learningPlanName } = entities;
  
  if (!email || !learningPlanName) {
    return NextResponse.json({
      response: `❌ **Missing Information**: I need both a user email and learning plan name to enroll.

**Examples:**
- "Enroll john@company.com in learning plan Data Science Fundamentals"
- "Add sarah@company.com to Leadership Development Path"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Find user
    const userDetails = await api.getUserDetails(email);
    const userId = userDetails.id;
    
    // Find learning plan
    const learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
    const learningPlanId = learningPlan.learning_plan_id || learningPlan.id;
    const learningPlanDisplayName = api.getLearningPlanName(learningPlan);
    
    // Check if already enrolled
    const existingEnrollments = await api.getUserLearningPlanEnrollments(userId);
    const alreadyEnrolled = existingEnrollments.enrollments.some((enrollment: any) => {
      const enrollmentLpId = enrollment.learning_plan_id || enrollment.id_learning_plan;
      return enrollmentLpId?.toString() === learningPlanId.toString();
    });
    
    if (alreadyEnrolled) {
      return NextResponse.json({
        response: `ℹ️ **Already Enrolled**

👤 **User**: ${userDetails.fullname} (${email})
📋 **Learning Plan**: ${learningPlanDisplayName}

✅ ${userDetails.fullname.split(' ')[0]} is already enrolled in this learning plan.`,
        success: true,
        data: { alreadyEnrolled: true },
        timestamp: new Date().toISOString()
      });
    }
    
    // Perform enrollment
    const enrollmentResult = await api.enrollUserInLearningPlan(userId, learningPlanId, {
      assignmentType: 'required'
    });
    
    return NextResponse.json({
      response: `✅ **Learning Plan Enrollment Successful**

👤 **User**: ${userDetails.fullname} (${email})
📋 **Learning Plan**: ${learningPlanDisplayName}
🆔 **Learning Plan ID**: ${learningPlanId}

🎉 **${userDetails.fullname.split(' ')[0]} has been successfully enrolled!**`,
      success: true,
      data: {
        enrolled: true,
        userInfo: userDetails,
        learningPlanInfo: { id: learningPlanId, name: learningPlanDisplayName },
        enrollmentResult: enrollmentResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Learning plan enrollment error:', error);
    return NextResponse.json({
      response: `❌ **Learning Plan Enrollment Failed**

**User**: ${email}
**Learning Plan**: "${learningPlanName}"

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUnenrollUserFromCourse(entities: any) {
  const { email, courseName } = entities;
  
  if (!email || !courseName) {
    return NextResponse.json({
      response: `❌ **Missing Information**: I need both a user email and course name to unenroll.

**Examples:**
- "Unenroll john@company.com from course Python Programming"
- "Remove sarah@company.com from Excel Training"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Find user
    const userDetails = await api.getUserDetails(email);
    const userId = userDetails.id;
    
    // Find course
    const course = await api.findCourseByIdentifier(courseName);
    const courseId = course.id || course.course_id;
    const courseDisplayName = api.getCourseName(course);
    
    // Check if currently enrolled
    const existingEnrollments = await api.getUserCourseEnrollments(userId);
    const currentEnrollment = existingEnrollments.enrollments.find((enrollment: any) => {
      const enrollmentCourseId = enrollment.course_id || enrollment.id_course;
      return enrollmentCourseId?.toString() === courseId.toString();
    });
    
    if (!currentEnrollment) {
      return NextResponse.json({
        response: `ℹ️ **Not Currently Enrolled**

👤 **User**: ${userDetails.fullname} (${email})
📚 **Course**: ${courseDisplayName}

❌ ${userDetails.fullname.split(' ')[0]} is not currently enrolled in this course.`,
        success: true,
        data: { notEnrolled: true },
        timestamp: new Date().toISOString()
      });
    }
    
    // Perform unenrollment
    const unenrollmentResult = await api.unenrollUserFromCourse(userId, courseId);
    
    return NextResponse.json({
      response: `✅ **Unenrollment Successful**

👤 **User**: ${userDetails.fullname} (${email})
📚 **Course**: ${courseDisplayName}

✅ **${userDetails.fullname.split(' ')[0]} has been successfully unenrolled.**`,
      success: true,
      data: {
        unenrolled: true,
        userInfo: userDetails,
        courseInfo: { id: courseId, name: courseDisplayName },
        unenrollmentResult: unenrollmentResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Course unenrollment error:', error);
    return NextResponse.json({
      response: `❌ **Unenrollment Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUnenrollUserFromLearningPlan(entities: any) {
  const { email, learningPlanName } = entities;
  
  if (!email || !learningPlanName) {
    return NextResponse.json({
      response: `❌ **Missing Information**: I need both a user email and learning plan name to unenroll.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    // Find user
    const userDetails = await api.getUserDetails(email);
    const userId = userDetails.id;
    
    // Find learning plan
    const learningPlan = await api.findLearningPlanByIdentifier(learningPlanName);
    const learningPlanId = learningPlan.learning_plan_id || learningPlan.id;
    const learningPlanDisplayName = api.getLearningPlanName(learningPlan);
    
    // Perform unenrollment
    const unenrollmentResult = await api.unenrollUserFromLearningPlan(userId, learningPlanId);
    
    return NextResponse.json({
      response: `✅ **Learning Plan Unenrollment Successful**

👤 **User**: ${userDetails.fullname} (${email})
📋 **Learning Plan**: ${learningPlanDisplayName}

✅ **${userDetails.fullname.split(' ')[0]} has been successfully unenrolled.**`,
      success: true,
      data: {
        unenrolled: true,
        userInfo: userDetails,
        learningPlanInfo: { id: learningPlanId, name: learningPlanDisplayName },
        unenrollmentResult: unenrollmentResult
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Learning plan unenrollment error:', error);
    return NextResponse.json({
      response: `❌ **Learning Plan Unenrollment Failed**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}
// EXISTING HANDLER FUNCTIONS (all preserved)
async function handleSpecificEnrollmentCheck(entities: any) {
  const { email, resourceName, resourceType, checkType, query } = entities;
  
  if (!email || !resourceName) {
    return NextResponse.json({
      response: `❌ **Missing Information**: I need both a user email and ${resourceType === 'learning_plan' ? 'learning plan' : 'course'} name.

**Examples:**
• "Check if john@company.com is enrolled in course Python Programming"
• "Check if sarah@company.com has completed learning plan Data Science Fundamentals"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const userDetails = await api.getUserDetails(email);
    const userId = userDetails.id;
    
    const enrollmentData = await api.getUserAllEnrollments(userId);
    
    if (!enrollmentData.success) {
      return NextResponse.json({
        response: `😔 **Could not retrieve enrollment data for ${userDetails.fullname}**`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    let foundEnrollment = null;
    
    if (resourceType === 'course') {
      const searchResults = enrollmentData.courses.enrollments.filter((enrollment: any) => {
        const formatted = api.formatCourseEnrollment(enrollment);
        return formatted.courseName.toLowerCase().includes(resourceName.toLowerCase());
      });
      foundEnrollment = searchResults.length > 0 ? searchResults[0] : null;
    } else {
      const searchResults = enrollmentData.learningPlans.enrollments.filter((enrollment: any) => {
        const formatted = api.formatLearningPlanEnrollment(enrollment);
        return formatted.learningPlanName.toLowerCase().includes(resourceName.toLowerCase());
      });
      foundEnrollment = searchResults.length > 0 ? searchResults[0] : null;
    }
    
    if (!foundEnrollment) {
      const resourceTypeDisplay = resourceType === 'learning_plan' ? 'learning plan' : 'course';
      
      return NextResponse.json({
        response: `❌ **No Enrollment Found**

**User**: ${userDetails.fullname} (${email})
**${resourceTypeDisplay.charAt(0).toUpperCase() + resourceTypeDisplay.slice(1)}**: "${resourceName}"

🔍 **Status**: **Not enrolled** - ${userDetails.fullname.split(' ')[0]} is not currently enrolled in this ${resourceTypeDisplay}.`,
        success: true,
        data: { enrolled: false, userFound: true, resourceFound: false },
        timestamp: new Date().toISOString()
      });
    }
    
    let formatted: any;
    let resourceId: string;
    let resourceDisplayName: string;
    
    if (resourceType === 'course') {
      formatted = api.formatCourseEnrollment(foundEnrollment);
      resourceId = formatted.courseId || 'Unknown ID';
      resourceDisplayName = formatted.courseName;
    } else {
      formatted = api.formatLearningPlanEnrollment(foundEnrollment);
      resourceId = formatted.learningPlanId || 'Unknown ID';
      resourceDisplayName = formatted.learningPlanName;
    }
    
    const status = formatted.enrollmentStatus;
    let statusIcon = '📚';
    let statusText = '';
    
    if (status === 'completed') {
      statusIcon = '✅';
      statusText = 'Completed';
    } else if (status === 'in_progress' || status === 'in-progress') {
      statusIcon = '🔄';
      statusText = 'In Progress';
    } else if (status === 'enrolled') {
      statusIcon = '📚';
      statusText = 'Enrolled';
    } else {
      statusIcon = '❓';
      statusText = status || 'Unknown';
    }
    
    let answerSummary = '';
    if (checkType === 'completion') {
      const isCompleted = status === 'completed';
      answerSummary = `**${isCompleted ? '✅ Yes' : '❌ No'}** - ${userDetails.fullname.split(' ')[0]} has ${isCompleted ? '' : '**not**'} completed this ${resourceType === 'learning_plan' ? 'learning plan' : 'course'}.`;
    } else {
      answerSummary = `**✅ Yes** - ${userDetails.fullname.split(' ')[0]} is enrolled in this ${resourceType === 'learning_plan' ? 'learning plan' : 'course'}.`;
    }
    
    return NextResponse.json({
      response: `🎯 **Enrollment Status Check**

👤 **User**: ${userDetails.fullname} (${email})
${resourceType === 'learning_plan' ? '📋' : '📚'} **${resourceType === 'learning_plan' ? 'Learning Plan' : 'Course'}**: ${resourceDisplayName}
🆔 **ID**: ${resourceId}

${answerSummary}

📊 **Current Status**: ${statusIcon} **${statusText}**`,
      success: true,
      data: {
        enrolled: true,
        status: statusText,
        completed: status === 'completed',
        userInfo: userDetails,
        enrollmentDetails: formatted
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Specific enrollment check error:', error);
    return NextResponse.json({
      response: `😔 **Error checking enrollment**

**Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleCourseInfo(entities: any) {
  const identifier = entities.courseId || entities.courseName;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing Course**: I need a course name or ID to get information about.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const course = await api.getCourseDetails(identifier);
    const courseName = api.getCourseName(course);
    const courseId = course.id || course.course_id || course.idCourse;
    
    return NextResponse.json({
      response: `📚 **Course Details**: ${courseName}

🆔 **Course ID**: ${courseId}
📊 **Status**: ${course.status || 'Unknown'}

**Course found successfully!**`,
      success: true,
      data: course,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Course Not Found**: Could not find course "${identifier}"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleLearningPlanInfo(entities: any) {
  const identifier = entities.learningPlanName;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing Learning Plan**: I need a learning plan name or ID.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const lp = await api.getLearningPlanDetails(identifier);
    const lpName = api.getLearningPlanName(lp);
    const lpId = lp.learning_plan_id || lp.id;
    
    return NextResponse.json({
      response: `📋 **Learning Plan Details**: ${lpName}

🆔 **ID**: ${lpId}

**Learning plan found successfully!**`,
      success: true,
      data: lp,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Learning Plan Not Found**: Could not find learning plan "${identifier}"`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleUserSearch(entities: any) {
  const searchTerm = entities.email || entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a name or email to search for.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    if (entities.email) {
      const userDetails = await api.getUserDetails(entities.email);
      
      return NextResponse.json({
        response: `👥 **User Found**: ${userDetails.fullname}

📧 **Email**: ${userDetails.email}
🆔 **User ID**: ${userDetails.id}
📊 **Status**: ${userDetails.status}`,
        success: true,
        timestamp: new Date().toISOString()
      });
    } else {
      const users = await api.searchUsers(searchTerm, 100);
      
      if (users.length === 0) {
        return NextResponse.json({
          response: `👥 **No Users Found**: No users match "${searchTerm}"`,
          success: false,
          timestamp: new Date().toISOString()
        });
      }
      
      const userList = users.slice(0, 10).map((user, i) => {
        const statusIcon = user.status === '1' ? '✅' : '❌';
        return `${i + 1}. ${statusIcon} **${user.fullname}** (${user.email})`;
      }).join('\n');
      
      return NextResponse.json({
        response: `👥 **User Search Results**: Found ${users.length} users

${userList}${users.length > 10 ? `\n\n... and ${users.length - 10} more users` : ''}`,
        success: true,
        totalCount: users.length,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    return NextResponse.json({
      response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleCourseSearch(entities: any) {
  const searchTerm = entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a course name to search for.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const courses = await api.searchCourses(searchTerm, 100);
    
    if (courses.length === 0) {
      return NextResponse.json({
        response: `📚 **No Courses Found**: No courses match "${searchTerm}"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const courseList = courses.slice(0, 10).map((course, i) => {
      const courseName = api.getCourseName(course);
      const courseId = course.id || course.course_id || 'N/A';
      
      return `${i + 1}. **${courseName}** (ID: ${courseId})`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📚 **Course Search Results**: Found ${courses.length} courses

${courseList}${courses.length > 10 ? `\n\n... and ${courses.length - 10} more courses` : ''}`,
      success: true,
      totalCount: courses.length,
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

async function handleLearningPlanSearch(entities: any) {
  const searchTerm = entities.searchTerm;
  
  if (!searchTerm || searchTerm.length < 2) {
    return NextResponse.json({
      response: `❌ **Missing Search Term**: I need a learning plan name to search for.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    const learningPlans = await api.searchLearningPlans(searchTerm, 100);
    
    if (learningPlans.length === 0) {
      return NextResponse.json({
        response: `📚 **No Learning Plans Found**: No learning plans match "${searchTerm}"`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    const planList = learningPlans.slice(0, 10).map((plan, i) => {
      const planName = api.getLearningPlanName(plan);
      const planId = plan.learning_plan_id || plan.id || 'N/A';
      
      return `${i + 1}. **${planName}** (ID: ${planId})`;
    }).join('\n\n');
    
    return NextResponse.json({
      response: `📚 **Learning Plan Search Results**: Found ${learningPlans.length} learning plans

${planList}${learningPlans.length > 10 ? `\n\n... and ${learningPlans.length - 10} more learning plans` : ''}`,
      success: true,
      totalCount: learningPlans.length,
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

async function handleUserEnrollments(entities: any) {
  const identifier = entities.email || entities.userId;
  
  if (!identifier) {
    return NextResponse.json({
      response: `❌ **Missing User**: I need a user email or ID to get enrollment information.`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
  
  try {
    let userId: string;
    let userDetails: any;
    
    if (identifier.includes('@')) {
      userDetails = await api.getUserDetails(identifier);
      userId = userDetails.id;
    } else {
      userId = identifier;
      try {
        const users = await api.searchUsers(identifier, 1);
        userDetails = users.length > 0 ? users[0] : { fullname: `User ${userId}`, email: 'Unknown' };
      } catch (error) {
        userDetails = { fullname: `User ${userId}`, email: 'Unknown' };
      }
    }
    
    const enrollmentData = await api.getUserAllEnrollments(userId);
    
    if (!enrollmentData.success) {
      return NextResponse.json({
        response: `😔 **Oops! I couldn't find enrollment data for ${userDetails.fullname}**`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }
    
    let courseSection = '';
    if (enrollmentData.courses.success && enrollmentData.totalCourses > 0) {
      const formattedCourses = enrollmentData.courses.enrollments.slice(0, 20).map((enrollment: any, i: number) => {
        const formatted = api.formatCourseEnrollment(enrollment);
        
        let statusIcon = '📚';
        let statusText = '';
        
        if (formatted.enrollmentStatus === 'completed') {
          statusIcon = '✅';
          statusText = 'Completed';
        } else if (formatted.enrollmentStatus === 'in_progress' || formatted.enrollmentStatus === 'in-progress') {
          statusIcon = '🔄';
          statusText = 'In Progress';
        } else if (formatted.enrollmentStatus === 'enrolled') {
          statusIcon = '📚';
          statusText = 'Enrolled';
        } else {
          statusIcon = '❓';
          statusText = formatted.enrollmentStatus || 'Unknown';
        }
        
        return `${i + 1}. ${statusIcon} **${formatted.courseName}** - *${statusText}*`;
      }).join('\n');
      
      courseSection = `📚 **Courses** (${enrollmentData.totalCourses} total)

${formattedCourses}`;
    }
    
    let learningPlanSection = '';
    if (enrollmentData.learningPlans.success && enrollmentData.totalLearningPlans > 0) {
      const formattedPlans = enrollmentData.learningPlans.enrollments.slice(0, 20).map((enrollment: any, i: number) => {
        const formatted = api.formatLearningPlanEnrollment(enrollment);
        
        let statusIcon = '📋';
        let statusText = '';
        
        if (formatted.enrollmentStatus === 'completed') {
          statusIcon = '✅';
          statusText = 'Completed';
        } else if (formatted.enrollmentStatus === 'in_progress' || formatted.enrollmentStatus === 'in-progress') {
          statusIcon = '🔄';
          statusText = 'In Progress';
        } else if (formatted.enrollmentStatus === 'enrolled') {
          statusIcon = '📋';
          statusText = 'Enrolled';
        } else {
          statusIcon = '❓';
          statusText = formatted.enrollmentStatus || 'Unknown';
        }
        
        return `${i + 1}. ${statusIcon} **${formatted.learningPlanName}** - *${statusText}*`;
      }).join('\n');
      
      learningPlanSection = `🎯 **Learning Plans** (${enrollmentData.totalLearningPlans} total)

${formattedPlans}`;
    }
    
    const sections = [courseSection, learningPlanSection].filter(section => section).join('\n\n');
    
    return NextResponse.json({
      response: `📊 **${userDetails.fullname}'s Learning Journey**

${sections}

🎉 **Quick Stats:**
• 📚 **${enrollmentData.totalCourses} courses total**
• 🎯 **${enrollmentData.totalLearningPlans} learning plans**`,
      success: true,
      data: enrollmentData,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Enrollment fetch error:', error);
    return NextResponse.json({
      response: `😔 **Oops! Something went wrong**

**Error details**: ${error instanceof Error ? error.message : 'Unknown error'}`,
      success: false,
      timestamp: new Date().toISOString()
    });
  }
}

async function handleDoceboHelp(entities: any) {
  const query = entities.query;
  
  return NextResponse.json({
    response: `🎯 **Docebo Help Request**: "${query}"

📖 **Manual Search Required**

For immediate assistance, please visit:
**Direct Link**: https://help.docebo.com/hc/en-us/search?query=${encodeURIComponent(query)}

**Popular Help Topics:**
• User management and enrollment
• Course creation and publishing  
• Reports and analytics
• API and integrations
• Learning plans and paths`,
    success: true,
    helpRequest: true,
    timestamp: new Date().toISOString()
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!api) {
      const config = getConfig();
      api = new DoceboAPI(config);
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
    
    const analysis = IntentAnalyzer.analyzeIntent(message);
    console.log(`🎯 Intent: ${analysis.intent}, Confidence: ${analysis.confidence}`);
    
    try {
switch (analysis.intent) {
  // NEW: Enrollment Management Cases - ADD THESE FIRST
  case 'enroll_user_in_course':
    return await handleEnrollUserInCourse(analysis.entities);
    
  case 'enroll_user_in_learning_plan':
    return await handleEnrollUserInLearningPlan(analysis.entities);
    
  case 'unenroll_user_from_course':
    return await handleUnenrollUserFromCourse(analysis.entities);
    
  case 'unenroll_user_from_learning_plan':
    return await handleUnenrollUserFromLearningPlan(analysis.entities);
    
  // EXISTING cases (keep all your current ones):
  case 'check_specific_enrollment':
    return await handleSpecificEnrollmentCheck(analysis.entities);
    
  case 'get_course_info':
    return await handleCourseInfo(analysis.entities);
          
        case 'get_learning_plan_info':
          return await handleLearningPlanInfo(analysis.entities);
          
        case 'search_users':
          return await handleUserSearch(analysis.entities);
          
        case 'search_courses':
          return await handleCourseSearch(analysis.entities);
          
        case 'search_learning_plans':
          return await handleLearningPlanSearch(analysis.entities);

        case 'get_user_enrollments':
          return await handleUserEnrollments(analysis.entities);
          
        case 'docebo_help':
          return await handleDoceboHelp(analysis.entities);
          
default:
    return NextResponse.json({
      response: `🤔 **I can help you with enrollment management!**

**✅ NEW: Enrollment Features**
- **Enroll in Course**: "Enroll john@company.com in course Python Programming"
- **Enroll in Learning Plan**: "Enroll sarah@company.com in learning plan Data Science"
- **Unenroll from Course**: "Unenroll mike@company.com from course Excel Training"
- **Unenroll from Learning Plan**: "Remove user@company.com from learning plan Leadership"

**📊 Existing Features:**
- **Check Enrollment**: "Check if john@company.com is enrolled in course Python Programming"
- **User Enrollments**: "User enrollments mike@company.com"
- **Find Users**: "Find user email@company.com"
- **Find Courses**: "Find Python courses"  
- **Find Learning Plans**: "Find Python learning plans"

**Try one of the examples above!**`,
      success: false,
      intent: analysis.intent,
      confidence: analysis.confidence,
      timestamp: new Date().toISOString()
    });
}
    } catch (error) {
      console.error('❌ Processing error:', error);
      return NextResponse.json({
        response: `❌ **Error**: ${error instanceof Error ? error.message : 'Unknown error'}`,
        success: false,
        timestamp: new Date().toISOString()
      });
    }

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
    status: 'Enhanced Docebo Chat API with Enrollment Management',
    version: '4.0.0',
    timestamp: new Date().toISOString(),
    features: [
      'Course and Learning Plan enrollment management',
      'Course and Learning Plan unenrollment',
      'Enrollment status checking and verification',
      'User search and details',
      'Course and learning plan search',
      'Natural language processing'
    ],
    enrollment_capabilities: [
      'Enroll user in course: "Enroll john@company.com in course Python Programming"',
      'Enroll user in learning plan: "Enroll sarah@company.com in learning plan Data Science"',
      'Unenroll from course: "Unenroll mike@company.com from course Excel Training"',
      'Unenroll from learning plan: "Remove user@company.com from learning plan Leadership"',
      'Check enrollment status: "Check if john@company.com is enrolled in course Python"',
      'View all enrollments: "User enrollments mike@company.com"'
    ]
  });
}
    // app/api/chat/route.ts - Complete Enhanced with enrollment management
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

// Enhanced intent detection with enrollment management
class IntentAnalyzer {
  static analyzeIntent(message: string): {
    intent: string;
    entities: any;
    confidence: number;
  } {
    const lower = message.toLowerCase().trim();
    
    // Extract entities first
    const email = this.extractEmail(message);
    const courseId = this.extractCourseId(message);
    const courseName = this.extractCourseName(message);
    const learningPlanName = this.extractLearningPlanName(message);
    
    // Intent patterns with confidence scores
    const patterns = [
      // Enrollment Management patterns - HIGHEST PRIORITY
 {
  intent: 'enroll_user_in_course',
  patterns: [
    /(?:enroll|add|assign|register|sign up)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i,
    /(?:enroll|add|assign)\s+(.+?)\s+(?:to|in)\s+(.+?)\s+(?:course|training)/i
  ],
  extractEntities: () => {
    const enrollMatch = message.match(/(?:enroll|add|assign|register|sign up)\s+(.+?)\s+(?:in|to|for)\s+(?:course|training)\s+(.+)/i);
    if (enrollMatch) {
      const userIdentifier = enrollMatch[1].trim();
      const resourceName = enrollMatch[2].trim();
      return {
        email: this.extractEmailFromText(userIdentifier) || userIdentifier,
        courseName: resourceName,
        resourceType: 'course',
        action: 'enroll'
      };
    }
    return { email: email, courseName: courseName, resourceType: 'course', action: 'enroll' };
  },
  confidence: 0.98
},

{
  intent: 'enroll_user_in_learning_plan',
  patterns: [
    /(?:enroll|add|assign|register|sign up)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
    /(?:assign|add)\s+(.+?)\s+(?:to|in)\s+(.+?)\s+(?:learning plan|lp)/i
  ],
  extractEntities: () => {
    const enrollMatch = message.match(/(?:enroll|add|assign|register|sign up)\s+(.+?)\s+(?:in|to|for)\s+(?:learning plan|lp|learning path)\s+(.+)/i);
    if (enrollMatch) {
      const userIdentifier = enrollMatch[1].trim();
      const resourceName = enrollMatch[2].trim();
      return {
        email: this.extractEmailFromText(userIdentifier) || userIdentifier,
        learningPlanName: resourceName,
        resourceType: 'learning_plan',
        action: 'enroll'
      };
    }
    return { email: email, learningPlanName: learningPlanName, resourceType: 'learning_plan', action: 'enroll' };
  },
  confidence: 0.98
},

{
  intent: 'unenroll_user_from_course',
  patterns: [
    /(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:course|training)\s+(.+)/i,
    /(?:remove|cancel)\s+(.+?)\s+(?:enrollment|registration)\s+(?:from|in)\s+(.+)/i
  ],
  extractEntities: () => {
    const unenrollMatch = message.match(/(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:course|training)\s+(.+)/i);
    if (unenrollMatch) {
      const userIdentifier = unenrollMatch[1].trim();
      const resourceName = unenrollMatch[2].trim();
      return {
        email: this.extractEmailFromText(userIdentifier) || userIdentifier,
        courseName: resourceName,
        resourceType: 'course',
        action: 'unenroll'
      };
    }
    return { email: email, courseName: courseName, resourceType: 'course', action: 'unenroll' };
  },
  confidence: 0.98
},

{
  intent: 'unenroll_user_from_learning_plan',
  patterns: [
    /(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:learning plan|lp|learning path)\s+(.+)/i,
    /(?:remove|cancel)\s+(.+?)\s+(?:from|in)\s+(.+?)\s+(?:learning plan|lp)/i
  ],
  extractEntities: () => {
    const unenrollMatch = message.match(/(?:unenroll|remove|unassign|drop|cancel)\s+(.+?)\s+(?:from)\s+(?:learning plan|lp|learning path)\s+(.+)/i);
    if (unenrollMatch) {
      const userIdentifier = unenrollMatch[1].trim();
      const resourceName = unenrollMatch[2].trim();
      return {
        email: this.extractEmailFromText(userIdentifier) || userIdentifier,
        learningPlanName: resourceName,
        resourceType: 'learning_plan',
        action: 'unenroll'
      };
    }
    return { email: email, learningPlanName: learningPlanName, resourceType: 'learning_plan', action: 'unenroll' };
  },
  confidence: 0.98
},
      
      // Specific enrollment check patterns - HIGH PRIORITY
      {
        intent: 'check_specific_enrollment',
        patterns: [
          /(?:check if|is)\s+(.+?)\s+(?:enrolled|taking|assigned to|has completed|completed)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:check status|status|enrollment details|enrollment status)\s+(?:of\s+)?(.+?)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:provide enrollment details|enrollment details)\s+(?:of\s+)?(.+?)\s+(?:in\s+)?(?:course|learning plan)\s+(.+)/i,
          /(?:has|did)\s+(.+?)\s+(?:complete|completed|finish|finished)\s+(?:course|learning plan)\s+(.+)/i
        ],
        extractEntities: () => {
          const emailInMessage = this.extractEmail(message);
          const isCompletionCheck = /(?:completed|complete|finish|finished|has completed)/i.test(message);
          const isLearningPlan = /learning plan/i.test(message);
          const isCourse = /course/i.test(message) && !isLearningPlan;
          
          let resourceName = '';
          if (isLearningPlan) {
            const lpMatch = message.match(/(?:learning plan)\s+(.+?)(?:\s*$|\?|!|\.)/i);
            if (lpMatch) resourceName = lpMatch[1].trim();
          } else if (isCourse) {
            const courseMatch = message.match(/(?:course)\s+(.+?)(?:\s*$|\?|!|\.)/i);
            if (courseMatch) resourceName = courseMatch[1].trim();
          }
          
          return {
            email: emailInMessage,
            resourceName: resourceName,
            resourceType: isLearningPlan ? 'learning_plan' : 'course',
            checkType: isCompletionCheck ? 'completion' : 'enrollment',
            query: message
          };
        },
        confidence: email ? 0.97 : 0.90
      },
      
      // Course Info patterns
      {
        intent: 'get_course_info',
        patterns: [
          /(?:course info|tell me about course|course details|info about course|course information)/i,
          /(?:what is|describe|explain).+course/i,
          /(?:details for|info for|information for).+course/i
        ],
        extractEntities: () => ({
          courseId: courseId,
          courseName: courseName || this.extractAfterPattern(message, /(?:course info|course details|info about course|tell me about course)\s+(.+)/i)
        }),
        confidence: 0.9
      },
      
      // Learning Plan Info patterns  
      {
        intent: 'get_learning_plan_info',
        patterns: [
          /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)/i,
          /(?:what is|describe|explain).+learning plan/i,
          /(?:details for|info for|information for).+learning plan/i,
          /(?:info|details)\s+(.+)$/i
        ],
        extractEntities: () => ({
          learningPlanName: learningPlanName || 
            this.extractAfterPattern(message, /(?:learning plan info|lp info|plan info|tell me about learning plan|learning plan details)\s+(.+)/i) ||
            this.extractAfterPattern(message, /(?:info|details)\s+(.+)$/i)
        }),
        confidence: 0.9
      },
      
      // User search patterns - LOWER PRIORITY than enrollments
      {
        intent: 'search_users',
        patterns: [
          /(?:find user|search user|look up user|user info|user details|who is|tell me about)(?!\s+enrollments)/i,
          /@[\w.-]+\.\w+(?!\s+enrollments)/i
        ],
        extractEntities: () => ({
          email: email,
          searchTerm: email || this.extractAfterPattern(message, /(?:find user|search user|look up user|user info|user details)\s+(.+)/i)
        }),
        confidence: email ? 0.90 : 0.7
      },
      
      // Course search patterns
      {
        intent: 'search_courses',
        patterns: [
          /(?:find course|search course|look for course|course search)/i,
          /(?:find|search).+course/i,
          /(?:courses about|courses on|courses for)/i
        ],
        extractEntities: () => ({
          searchTerm: courseName || this.extractAfterPattern(message, /(?:find|search|look for)\s+(.+?)\s+course/i) ||
                     this.extractAfterPattern(message, /(?:courses about|courses on|courses for)\s+(.+)/i)
        }),
        confidence: 0.8
      },
      
      // Learning plan search patterns
      {
        intent: 'search_learning_plans',
        patterns: [
          /(?:find learning plan|search learning plan|learning plans about|learning plans for)/i,
          /(?:find|search).+learning plan/i,
          /learning plans?/i
        ],
        extractEntities: () => ({
          searchTerm: learningPlanName || this.extractAfterPattern(message, /(?:find|search)\s+(.+?)\s+learning plan/i) ||
                     this.extractAfterPattern(message, /(?:learning plans about|learning plans for)\s+(.+)/i)
        }),
        confidence: 0.8
      },

      // User enrollment patterns - HIGH PRIORITY
      {
        intent: 'get_user_enrollments',
        patterns: [
          /(?:user enrollments|enrollments for user|enrollments for|show enrollments)/i,
          /(?:what courses is|what learning plans is|what is.*enrolled)/i,
          /(?:enrolled in|taking|assigned to|learning progress|user progress)/i,
          /(?:get enrollments|show courses for|list courses for)/i
        ],
        extractEntities: () => ({
          email: email,
          userId: email || this.extractAfterPattern(message, /(?:user enrollments|enrollments for|show enrollments|get enrollments|show courses for|list courses for)\s+(.+?)(?:\s|$)/i)
        }),
        confidence: email ? 0.95 : 0.85
      },
      
      // Help patterns
      {
        intent: 'docebo_help',
        patterns: [
          /(?:how to|how do i|how does|how can i)/i,
          /(?:help|guide|tutorial|documentation)/i,
          /(?:configure|setup|enable|create|manage)/i,
          /(?:troubleshoot|problem|issue|error)/i
        ],
        extractEntities: () => ({
          query: message
        }),
        confidence: 0.6
      }
    ];
    
    // Find best matching pattern
    let bestMatch = { intent: 'unknown', entities: {}, confidence: 0 };
    
    for (const pattern of patterns) {
      for (const regex of pattern.patterns) {
        if (regex.test(lower)) {
          if (pattern.confidence > bestMatch.confidence) {
            bestMatch = {
              intent: pattern.intent,
              entities: pattern.extractEntities(),
              confidence: pattern.confidence
            };
          }
        }
      }
    }
    
    return bestMatch;
  }
  
  static extractEmail(message: string): string | null {
    const match = message.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
    return match ? match[0] : null;
  }
  
  static extractEmailFromText(text: string): string | null {
  const match = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
  return match ? match[0] : null;
}
  
  static extractCourseId(message: string): string | null {
    const patterns = [
      /(?:course\s+)?id[:\s]+(\d+)/i,
      /(?:course\s+)?#(\d+)/i,
      /\bid\s*:?\s*(\d+)/i
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) return match[1];
    }
    return null;
  }
  
  static extractCourseName(message: string): string | null {
    const patterns = [
      /(?:course\s+info\s+|course\s+details\s+|course\s+information\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:tell me about course\s+|info about course\s+)(.+?)(?:\s+(?:id|ID)\s*:?\s*\d+)?$/i,
      /(?:in course\s+|course named\s+|course called\s+)(.+?)(?:\s|$)/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        name = name.replace(/^(info|details|about|course)\s+/i, '');
        return name;
      }
    }
    return null;
  }
  
  static extractLearningPlanName(message: string): string | null {
    const patterns = [
      /(?:learning plan info\s+|lp info\s+|plan info\s+)(.+)/i,
      /(?:tell me about learning plan\s+|learning plan details\s+)(.+)/i,
      /(?:info\s+|details\s+)(.+?)(?:\s+learning plan)?$/i,
      /"([^"]+)"/,
      /\[([^\]]+)\]/
    ];
    
    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1] && match[1].length > 2) {
        let name = match[1].trim();
        if (!name.match(/^(for|about|on|in|the|a|an|info|details)$/i)) {
          name = name.replace(/^(info|details|about|learning plan)\s+/i, '');
          return name;
        }
      }
    }
    return null;
  }
  
  static extractAfterPattern(message: string, pattern: RegExp): string | null {
    const match = message.match(pattern);
    return match && match[1] ? match[1].trim() : null;
  }
}

// Enhanced Docebo API client with enrollment management
class DoceboAPI {
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

  private async apiRequest(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any, params?: any): Promise<any> {
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

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    if (method !== 'GET' && body) {
      headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  // NEW: Enrollment Management Methods
  async enrollUserInCourse(userId: string, courseId: string, options: any = {}): Promise<any> {
  console.log(`📚 Enrolling user ${userId} in course ${courseId}`);
  
  try {
    const enrollmentBody = {
      users: [userId],
      courses: [courseId],
      level: options.level || 'student',
      assignment_type: options.assignmentType || 'required'
    };

    const result = await this.apiRequest('/learn/v1/enrollments', 'POST', enrollmentBody);
    return { success: true, result: result.data || result };
  } catch (error) {
    console.error('Course enrollment failed:', error);
    throw error;
  }
}

async enrollUserInLearningPlan(userId: string, learningPlanId: string, options: any = {}): Promise<any> {
  console.log(`📋 Enrolling user ${userId} in learning plan ${learningPlanId}`);
  
  try {
    const enrollmentBody = {
      users: [userId],
      learning_plans: [learningPlanId],
      assignment_type: options.assignmentType || 'required'
    };

    const result = await this.apiRequest('/learningplan/v1/learningplans/enrollments', 'POST', enrollmentBody);
    return { success: true, result: result.data || result };
  } catch (error) {
    console.error('Learning plan enrollment failed:', error);
    throw error;
  }
}

async unenrollUserFromCourse(userId: string, courseId: string): Promise<any> {
  console.log(`❌ Unenrolling user ${userId} from course ${courseId}`);
  
  try {
    const result = await this.apiRequest(`/learn/v1/enrollments`, 'DELETE', null, {
      user_id: userId,
      course_id: courseId
    });
    return { success: true, result: result.data || result };
  } catch (error) {
    console.error('Course unenrollment failed:', error);
    throw error;
  }
}

async unenrollUserFromLearningPlan(userId: string, learningPlanId: string): Promise<any> {
  console.log(`❌ Unenrolling user ${userId} from learning plan ${learningPlanId}`);
  
  try {
    const result = await this.apiRequest(`/learningplan/v1/learningplans/enrollments`, 'DELETE', null, {
      user_id: userId,
      learning_plan_id: learningPlanId
    });
    return { success: true, result: result.data || result };
  } catch (error) {
    console.error('Learning plan unenrollment failed:', error);
    throw error;
  }
}

async findLearningPlanByIdentifier(identifier: string): Promise<any> {
  console.log(`🔍 Finding learning plan: "${identifier}"`);
  
  if (/^\d+$/.test(identifier)) {
    try {
      const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`);
      if (directResult.data) {
        console.log(`✅ Found learning plan by direct ID: ${identifier}`);
        return directResult.data;
      }
    } catch (error) {
      console.log(`❌ Direct learning plan lookup failed, trying search...`);
    }
  }
  
  const learningPlans = await this.searchLearningPlans(identifier, 100);
  const lp = learningPlans.find((plan: any) => 
    plan.learning_plan_id?.toString() === identifier ||
    plan.id?.toString() === identifier ||
    this.getLearningPlanName(plan).toLowerCase().includes(identifier.toLowerCase()) ||
    plan.code === identifier
  );
  
  if (!lp) {
    throw new Error(`Learning plan not found: ${identifier}`);
  }
  
  return lp;
}
  async getCourseDetails(identifier: string): Promise<any> {
    const course = await this.findCourseByIdentifier(identifier);
    const courseId = course.id || course.course_id;
    
    try {
      const detailsResult = await this.apiRequest(`/course/v1/courses/${courseId}`);
      if (detailsResult.data) {
        return detailsResult.data;
      }
    } catch (error) {
      console.log('Could not get detailed course info, using search result');
    }
    
    return course;
  }

  async getLearningPlanDetails(identifier: string): Promise<any> {
    console.log(`🔍 Finding learning plan: "${identifier}"`);
    
    if (/^\d+$/.test(identifier)) {
      try {
        const directResult = await this.apiRequest(`/learningplan/v1/learningplans/${identifier}`);
        if (directResult.data) {
          console.log(`✅ Found learning plan by direct ID: ${identifier}`);
          return directResult.data;
        }
      } catch (error) {
        console.log(`❌ Direct learning plan lookup failed, trying search...`);
      }
    }
    
    const learningPlans = await this.searchLearningPlans(identifier, 100);
    const lp = learningPlans.find((plan: any) => 
      plan.learning_plan_id?.toString() === identifier ||
      plan.id?.toString() === identifier ||
      this.getLearningPlanName(plan).toLowerCase().includes(identifier.toLowerCase()) ||
      plan.code === identifier
    );
    
    if (!lp) {
      throw new Error(`Learning plan not found: ${identifier}`);
    }
    
    return lp;
  }

  async searchUsers(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/manage/v1/user', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchCourses(searchText: string, limit: number = 100): Promise<any[]> {
    const result = await this.apiRequest('/course/v1/courses', {
      search_text: searchText,
      page_size: Math.min(limit, 200)
    });
    return result.data?.items || [];
  }

  async searchLearningPlans(searchText: string, limit: number = 100): Promise<any[]> {
    try {
      const result = await this.apiRequest('/learningplan/v1/learningplans', {
        search_text: searchText,
        page_size: Math.min(limit, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (result.data?.items?.length > 0) {
        return result.data.items;
      }
      
      const allResult = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: Math.min(limit * 2, 200),
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      if (allResult.data?.items?.length > 0) {
        const filteredPlans = allResult.data.items.filter((lp: any) => {
          const name = this.getLearningPlanName(lp).toLowerCase();
          const description = (lp.description || '').toLowerCase();
          return name.includes(searchText.toLowerCase()) || 
                 description.includes(searchText.toLowerCase());
        });
        
        return filteredPlans.slice(0, limit);
      }
      
      return [];
      
    } catch (error) {
      console.error(`❌ Learning plan search failed:`, error);
      return [];
    }
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

    return {
      id: user.user_id || user.id,
      fullname: user.fullname || `${user.firstname || ''} ${user.lastname || ''}`.trim() || 'Not available',
      email: user.email,
      username: user.username || 'Not available',
      status: user.status === '1' ? 'Active' : user.status === '0' ? 'Inactive' : `Status: ${user.status}`,
      level: user.level === 'godadmin' ? 'Superadmin' : user.level || 'User',
      creationDate: user.register_date || user.creation_date || user.created_at || 'Not available',
      lastAccess: user.last_access_date || user.last_access || user.last_login || 'Not available',
      timezone: user.timezone || 'Not specified',
      language: user.language || user.lang_code || 'Not specified',
      department: user.department || 'Not specified'
    };
  }

  async getUserCourseEnrollments(userId: string): Promise<any> {
    console.log(`📚 Getting course enrollments for user: ${userId}`);
    
    const endpoints = [
      `/course/v1/courses/enrollments?user_id=${userId}`,
      `/learn/v1/enrollments?id_user=${userId}`,
      `/course/v1/courses/enrollments?id_user=${userId}`
    ];
    
    for (const endpoint of endpoints) {
      try {
        console.log(`🔍 Trying course enrollment endpoint: ${endpoint}`);
        const result = await this
