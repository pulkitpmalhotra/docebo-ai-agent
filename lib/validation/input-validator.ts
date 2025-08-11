// lib/validation/input-validator.ts
import { z } from 'zod';

// Schema definitions
export const ChatRequestSchema = z.object({
  message: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message too long (max 2000 characters)')
    .refine(
      (msg) => !msg.includes('<script>') && !msg.includes('javascript:') && !msg.includes('data:'),
      'Message contains potentially dangerous content'
    ),
  userRole: z.enum(['superadmin', 'power_user', 'user_manager', 'user']).optional().default('user'),
  userId: z.string().max(100).optional()
});

export const UserSearchSchema = z.object({
  identifier: z.string()
    .min(1, 'Search term required')
    .max(100, 'Search term too long')
    .refine(
      (term) => /^[a-zA-Z0-9@._\-\s]+$/.test(term),
      'Search term contains invalid characters. Only letters, numbers, @, ., _, -, and spaces allowed'
    ),
  type: z.enum(['email', 'username', 'id', 'name']).optional().default('email')
});

export const CourseSearchSchema = z.object({
  query: z.string()
    .min(1, 'Search query required')
    .max(200, 'Search query too long')
    .refine(
      (query) => !/[<>'"]/g.test(query),
      'Search query contains invalid characters'
    ),
  limit: z.number().min(1).max(100).optional().default(25),
  type: z.enum(['title', 'id', 'code']).optional().default('title')
});

export const EnrollmentRequestSchema = z.object({
  userId: z.string().min(1, 'User ID required'),
  courseId: z.string().min(1, 'Course ID required'),
  enrollmentType: z.enum(['immediate', 'scheduled']).optional().default('immediate'),
  enrollmentDate: z.string().datetime().optional()
});

// Environment validation schema
const EnvironmentSchema = z.object({
  DOCEBO_DOMAIN: z.string().min(1, 'DOCEBO_DOMAIN is required'),
  DOCEBO_CLIENT_ID: z.string().min(1, 'DOCEBO_CLIENT_ID is required'),
  DOCEBO_CLIENT_SECRET: z.string().min(1, 'DOCEBO_CLIENT_SECRET is required'),
  DOCEBO_USERNAME: z.string().min(1, 'DOCEBO_USERNAME is required'),
  DOCEBO_PASSWORD: z.string().min(1, 'DOCEBO_PASSWORD is required'),
  GOOGLE_GEMINI_API_KEY: z.string().min(1, 'GOOGLE_GEMINI_API_KEY is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional()
});

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export class InputValidator {
  // Main validation methods
  static validateChatRequest(data: unknown): ValidationResult<z.infer<typeof ChatRequestSchema>> {
    try {
      const validated = ChatRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof z.ZodError 
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
          : ['Invalid request format']
      };
    }
  }

  static validateUserSearch(data: unknown): ValidationResult<z.infer<typeof UserSearchSchema>> {
    try {
      const validated = UserSearchSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof z.ZodError 
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
          : ['Invalid search parameters']
      };
    }
  }

  static validateCourseSearch(data: unknown): ValidationResult<z.infer<typeof CourseSearchSchema>> {
    try {
      const validated = CourseSearchSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof z.ZodError 
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
          : ['Invalid course search parameters']
      };
    }
  }

  static validateEnrollmentRequest(data: unknown): ValidationResult<z.infer<typeof EnrollmentRequestSchema>> {
    try {
      const validated = EnrollmentRequestSchema.parse(data);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof z.ZodError 
          ? error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`)
          : ['Invalid enrollment parameters']
      };
    }
  }

  // Text sanitization methods
  static sanitizeMessage(message: string): string {
    return message
      // Remove script tags and javascript
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      // Remove potentially dangerous HTML
      .replace(/<iframe|<object|<embed|<link|<meta/gi, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit length as additional safety
      .substring(0, 2000);
  }

  static sanitizeSearchTerm(term: string): string {
    return term
      // Remove HTML and script content
      .replace(/[<>'"]/g, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+=/gi, '')
      // Keep only safe characters
      .replace(/[^\w@._\-\s]/g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
      // Limit length
      .substring(0, 100);
  }

  static sanitizeUserInput(input: string): string {
    return input
      .replace(/[<>'"&]/g, (match) => {
        const entityMap: Record<string, string> = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;',
          '&': '&amp;'
        };
        return entityMap[match] || match;
      })
      .trim()
      .substring(0, 500);
  }

  // Environment validation
  static validateEnvironment(): ValidationResult<z.infer<typeof EnvironmentSchema>> {
    try {
      const env = {
        DOCEBO_DOMAIN: process.env.DOCEBO_DOMAIN,
        DOCEBO_CLIENT_ID: process.env.DOCEBO_CLIENT_ID,
        DOCEBO_CLIENT_SECRET: process.env.DOCEBO_CLIENT_SECRET,
        DOCEBO_USERNAME: process.env.DOCEBO_USERNAME,
        DOCEBO_PASSWORD: process.env.DOCEBO_PASSWORD,
        GOOGLE_GEMINI_API_KEY: process.env.GOOGLE_GEMINI_API_KEY,
        NODE_ENV: process.env.NODE_ENV as 'development' | 'production' | 'test' | undefined
      };

      const validated = EnvironmentSchema.parse(env);
      return { success: true, data: validated };
    } catch (error) {
      return {
        success: false,
        errors: error instanceof z.ZodError 
          ? error.issues.map(issue => `Environment variable ${issue.path.join('.')}: ${issue.message}`)
          : ['Environment validation failed']
      };
    }
  }

  // Security checks
  static detectSQLInjection(input: string): boolean {
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\b)/i,
      /(UNION\s+(ALL\s+)?SELECT)/i,
      /((;|--|\|\|).*)/i,
      /(\/\*.*\*\/)/i
    ];

    return sqlPatterns.some(pattern => pattern.test(input));
  }

  static detectXSS(input: string): boolean {
    const xssPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      /javascript:/gi,
      /on\w+\s*=/gi,
      /<iframe|<object|<embed/gi,
      /data:text\/html/gi
    ];

    return xssPatterns.some(pattern => pattern.test(input));
  }

  static detectCommandInjection(input: string): boolean {
    const cmdPatterns = [
      /(\||&|;|\$\(|\`)/,
      /(rm\s|wget\s|curl\s|nc\s|telnet\s)/i,
      /(\.\.\/|\.\.\\)/
    ];

    return cmdPatterns.some(pattern => pattern.test(input));
  }

  // Comprehensive security validation
  static validateSecurity(input: string): {
    safe: boolean;
    threats: string[];
    sanitized: string;
  } {
    const threats: string[] = [];
    
    if (this.detectSQLInjection(input)) {
      threats.push('SQL Injection');
    }
    
    if (this.detectXSS(input)) {
      threats.push('Cross-Site Scripting (XSS)');
    }
    
    if (this.detectCommandInjection(input)) {
      threats.push('Command Injection');
    }

    return {
      safe: threats.length === 0,
      threats,
      sanitized: this.sanitizeUserInput(input)
    };
  }

  // Rate limiting validation
  static validateRateLimit(identifier: string, maxRequests: number = 100): boolean {
    // This would integrate with your rate limiter
    // For now, basic validation
    return identifier.length > 0 && maxRequests > 0;
  }
}

// Type exports for better TypeScript support
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type UserSearchRequest = z.infer<typeof UserSearchSchema>;
export type CourseSearchRequest = z.infer<typeof CourseSearchSchema>;
export type EnrollmentRequest = z.infer<typeof EnrollmentRequestSchema>;
export type Environment = z.infer<typeof EnvironmentSchema>;
