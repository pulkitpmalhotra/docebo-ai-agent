// __tests__/api/intent-analyzer.test.js
import { IntentAnalyzer   static extractMultipleEmails(message: string): string[] {
    const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
    const emails = message.match(emailRegex) || [];
    return [...new Set(emails.map(email => email.toLowerCase()))];
  }
  
  static parseTeamReference(message: string): { teamName?: string } {
    const teamPatterns = [
      /\b(marketing|sales|hr|engineering|finance|support|admin|management)\s+team\b/i,
      /\b(developers?|managers?|admins?|analysts?)\b/i
    ];

    for (const pattern of teamPatterns) {
      const match = message.match(pattern);
      if (match) {
        return { teamName: match[1] };
      }
    }

    return {};
  }
} from '../../app/api/chat/intent-analyzer'

describe('IntentAnalyzer', () => {
  describe('analyzeIntent', () => {
    describe('enrollment intents', () => {
      it('should detect course enrollment intent', () => {
        const messages = [
          'Enroll john@company.com in course Python Programming',
          'Add sarah@test.com to course Excel Training',
          'Register mike@company.com for training JavaScript Basics'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('enroll_user_in_course')
          expect(analysis.confidence).toBeGreaterThan(0.9)
          expect(analysis.entities.email).toBeDefined()
          expect(analysis.entities.courseName).toBeDefined()
          expect(analysis.entities.resourceType).toBe('course')
          expect(analysis.entities.action).toBe('enroll')
        })
      })

      it('should detect learning plan enrollment intent', () => {
        const messages = [
          'Enroll john@company.com in learning plan Data Science',
          'Add sarah@test.com to learning path Leadership Development',
          'Assign mike@company.com to lp Python Fundamentals'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('enroll_user_in_learning_plan')
          expect(analysis.confidence).toBeGreaterThan(0.9)
          expect(analysis.entities.email).toBeDefined()
          expect(analysis.entities.learningPlanName).toBeDefined()
          expect(analysis.entities.resourceType).toBe('learning_plan')
          expect(analysis.entities.action).toBe('enroll')
        })
      })

      it('should detect course unenrollment intent', () => {
        const messages = [
          'Unenroll john@company.com from course Python Programming',
          'Remove sarah@test.com from training Excel Basics',
          'Drop mike@company.com from course JavaScript'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('unenroll_user_from_course')
          expect(analysis.confidence).toBeGreaterThan(0.9)
          expect(analysis.entities.email).toBeDefined()
          expect(analysis.entities.courseName).toBeDefined()
          expect(analysis.entities.resourceType).toBe('course')
          expect(analysis.entities.action).toBe('unenroll')
        })
      })

      it('should detect learning plan unenrollment intent', () => {
        const messages = [
          'Unenroll john@company.com from learning plan Data Science',
          'Remove sarah@test.com from learning path Leadership',
          'Cancel mike@company.com from lp Python Fundamentals'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('unenroll_user_from_learning_plan')
          expect(analysis.confidence).toBeGreaterThan(0.9)
          expect(analysis.entities.email).toBeDefined()
          expect(analysis.entities.learningPlanName).toBeDefined()
          expect(analysis.entities.resourceType).toBe('learning_plan')
          expect(analysis.entities.action).toBe('unenroll')
        })
      })
    })

    describe('enrollment check intents', () => {
      it('should detect specific enrollment check', () => {
        const messages = [
          'Check if john@company.com is enrolled in course Python Programming',
          'Is sarah@test.com taking course Excel Training',
          'Has mike@company.com completed learning plan Data Science'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('check_specific_enrollment')
          expect(analysis.confidence).toBeGreaterThan(0.85)
          expect(analysis.entities.email).toBeDefined()
          expect(analysis.entities.resourceName).toBeDefined()
          expect(analysis.entities.resourceType).toMatch(/course|learning_plan/)
        })
      })

      it('should detect user enrollments intent', () => {
        const messages = [
          'User enrollments john@company.com',
          'Show enrollments for sarah@test.com',
          'What courses is mike@company.com taking',
          'Get enrollments mike@company.com'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('get_user_enrollments')
          expect(analysis.confidence).toBeGreaterThan(0.8)
          expect(analysis.entities.email || analysis.entities.userId).toBeDefined()
        })
      })
    })

    describe('search intents', () => {
      it('should detect user search intent', () => {
        const messages = [
          'Find user john@company.com',
          'Search user sarah@test.com',
          'Look up user mike@company.com',
          'Who is admin@company.com'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('search_users')
          expect(analysis.confidence).toBeGreaterThan(0.7)
          expect(analysis.entities.email || analysis.entities.searchTerm).toBeDefined()
        })
      })

      it('should detect course search intent', () => {
        const messages = [
          'Find Python courses',
          'Search for Excel training',
          'Look for JavaScript courses',
          'Courses about data science'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('search_courses')
          expect(analysis.confidence).toBeGreaterThan(0.7)
          expect(analysis.entities.searchTerm).toBeDefined()
        })
      })

      it('should detect learning plan search intent', () => {
        const messages = [
          'Find Python learning plans',
          'Search for leadership learning paths',
          'Learning plans about data science',
          'Find learning plan management'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('search_learning_plans')
          expect(analysis.confidence).toBeGreaterThan(0.7)
          expect(analysis.entities.searchTerm).toBeDefined()
        })
      })
    })

    describe('info intents', () => {
      it('should detect course info intent', () => {
        const messages = [
          'Course info Python Programming',
          'Tell me about course Excel Training',
          'Course details JavaScript Basics',
          'What is course Data Science'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('get_course_info')
          expect(analysis.confidence).toBeGreaterThan(0.8)
          expect(analysis.entities.courseName).toBeDefined()
        })
      })

      it('should detect learning plan info intent', () => {
        const messages = [
          'Learning plan info Data Science',
          'Tell me about learning plan Leadership',
          'LP info Python Fundamentals',
          'Info Associate Memory Network'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('get_learning_plan_info')
          expect(analysis.confidence).toBeGreaterThan(0.8)
          expect(analysis.entities.learningPlanName).toBeDefined()
        })
      })
    })

    describe('help intent', () => {
      it('should detect help requests', () => {
        const messages = [
          'How to enroll users in Docebo',
          'Help with course management',
          'How do I create users',
          'Troubleshoot enrollment issues'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('docebo_help')
          expect(analysis.entities.query).toBe(message)
        })
      })
    })

    describe('unknown intent', () => {
      it('should return unknown for unrecognized messages', () => {
        const messages = [
          'Hello there',
          'Random text',
          'What is the weather',
          '12345'
        ]

        messages.forEach(message => {
          const analysis = IntentAnalyzer.analyzeIntent(message)
          expect(analysis.intent).toBe('unknown')
          expect(analysis.confidence).toBe(0)
        })
      })
    })
  })

  describe('helper methods', () => {
    describe('extractEmail', () => {
      it('should extract valid email addresses', () => {
        const testCases = [
          { text: 'Find user john@company.com', expected: 'john@company.com' },
          { text: 'Email sarah.smith@test-company.org for info', expected: 'sarah.smith@test-company.org' },
          { text: 'Contact admin_user@subdomain.example.com', expected: 'admin_user@subdomain.example.com' },
          { text: 'No email here', expected: null },
          { text: 'Invalid email @company.com', expected: null }
        ]

        testCases.forEach(({ text, expected }) => {
          const result = IntentAnalyzer.extractEmail(text)
          expect(result).toBe(expected)
        })
      })
    })

    describe('extractCourseId', () => {
      it('should extract course IDs from text', () => {
        const testCases = [
          { text: 'Course ID: 123', expected: '123' },
          { text: 'course id 456', expected: '456' },
          { text: 'Course #789', expected: '789' },
          { text: 'id: 999', expected: '999' },
          { text: 'No ID here', expected: null }
        ]

        testCases.forEach(({ text, expected }) => {
          const result = IntentAnalyzer.extractCourseId(text)
          expect(result).toBe(expected)
        })
      })
    })

    describe('extractCourseName', () => {
      it('should extract course names from text', () => {
        const testCases = [
          { text: 'Course info Python Programming', expected: 'Python Programming' },
          { text: 'Tell me about course "Excel Training"', expected: 'Excel Training' },
          { text: 'Course details [JavaScript Basics]', expected: 'JavaScript Basics' },
          { text: 'in course Data Science 101', expected: 'Data Science 101' }
        ]

        testCases.forEach(({ text, expected }) => {
          const result = IntentAnalyzer.extractCourseName(text)
          expect(result).toBe(expected)
        })
      })
    })

    describe('extractLearningPlanName', () => {
      it('should extract learning plan names from text', () => {
        const testCases = [
          { text: 'Learning plan info Data Science', expected: 'Data Science' },
          { text: 'LP info "Leadership Development"', expected: 'Leadership Development' },
          { text: 'Plan info [Python Fundamentals]', expected: 'Python Fundamentals' },
          { text: 'Info Associate Memory Network', expected: 'Associate Memory Network' }
        ]

        testCases.forEach(({ text, expected }) => {
          const result = IntentAnalyzer.extractLearningPlanName(text)
          expect(result).toBe(expected)
        })
      })
    })
  })
})
