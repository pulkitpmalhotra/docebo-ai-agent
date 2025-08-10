// lib/docebo-enhanced.ts - Fixed version
import { DoceboClient } from './docebo';

interface SearchResult {
  found: boolean;
  data?: any;
  message?: string;
  error?: string;
  suggestions?: any[];
  debug?: any;
}

export class EnhancedDoceboClient extends DoceboClient {
  
  async getUserStatus(identifier: string, type: 'email' | 'username' | 'id'): Promise<SearchResult> {
    console.log(`🔍 EnhancedDoceboClient.getUserStatus called: ${identifier} (${type})`);
    
    try {
      if (type === 'id') {
        console.log('📋 Searching by ID...');
        const user = await super.getUserById(parseInt(identifier));
        console.log('📊 User by ID result:', user);
        return {
          found: !!user,
          data: user,
          debug: { searchType: 'id', identifier, rawResult: user }
        };
        
      } else if (type === 'email') {
        console.log('📧 Searching by email...');
        
        // Method 1: Try direct email search
        console.log('🔍 Trying direct getUserByEmail...');
        try {
          const directUser = await super.getUserByEmail(identifier);
          console.log('📊 Direct email search result:', directUser);
          
          if (directUser) {
            return {
              found: true,
              data: directUser,
              debug: { searchType: 'email_direct', identifier, rawResult: directUser }
            };
          }
        } catch (directError) {
          console.log('⚠️ Direct email search failed:', directError);
        }
        
        // Method 2: Try broader search with search_text
        console.log('🔍 Trying broader search with getUsers...');
        try {
          const users = await super.getUsers({ search: identifier });
          console.log('📊 Broader search result:', users);
          
          if (users.data && users.data.length > 0) {
            console.log(`📊 Found ${users.data.length} users, checking for email matches...`);
            
            // Look for exact email match
            const exactMatch = users.data.find((user: any) => {
              const userEmail = user.email?.toLowerCase();
              const searchEmail = identifier.toLowerCase();
              console.log(`🔍 Comparing: "${userEmail}" vs "${searchEmail}"`);
              return userEmail === searchEmail;
            });
            
            if (exactMatch) {
              console.log('✅ Found exact email match:', exactMatch);
              return {
                found: true,
                data: exactMatch,
                debug: { 
                  searchType: 'email_broader_exact', 
                  identifier, 
                  totalResults: users.data.length,
                  exactMatch,
                  allEmails: users.data.map((u: any) => u.email)
                }
              };
            }
            
            // Look for partial match
            const partialMatch = users.data.find((user: any) => 
              user.email?.toLowerCase().includes(identifier.toLowerCase())
            );
            
            if (partialMatch) {
              console.log('⚠️ Found partial email match:', partialMatch);
              return {
                found: true,
                data: partialMatch,
                debug: { 
                  searchType: 'email_broader_partial', 
                  identifier, 
                  totalResults: users.data.length,
                  partialMatch,
                  allEmails: users.data.map((u: any) => u.email)
                }
              };
            }
            
            // No matches found
            return {
              found: false,
              message: `No user found with email "${identifier}". Found ${users.data.length} users but none matched.`,
              debug: { 
                searchType: 'email_broader_nomatch', 
                identifier, 
                totalResults: users.data.length,
                allEmails: users.data.map((u: any) => u.email),
                allUsernames: users.data.map((u: any) => u.username),
                sampleUsers: users.data.slice(0, 3)
              }
            };
          } else {
            return {
              found: false,
              message: `No users found when searching for "${identifier}"`,
              debug: { searchType: 'email_no_results', identifier, rawResult: users }
            };
          }
        } catch (broadError) {
          console.error('❌ Broader search failed:', broadError);
          return {
            found: false,
            error: `Search failed: ${broadError instanceof Error ? broadError.message : 'Unknown error'}`,
            debug: { searchType: 'email_broad_error', identifier, error: broadError }
          };
        }
        
      } else { // username search
        console.log('👤 Searching by username...');
        const users = await super.getUsers({ search: identifier });
        console.log('📊 Username search result:', users);
        
        if (users.data && users.data.length > 0) {
          const foundUser = users.data.find((user: any) => user.username === identifier);
          
          return {
            found: !!foundUser,
            data: foundUser,
            debug: { 
              searchType: 'username', 
              identifier, 
              totalResults: users.data.length,
              foundUser,
              allUsernames: users.data.map((u: any) => u.username)
            }
          };
        }
        
        return {
          found: false,
          message: `No users found when searching for username "${identifier}"`,
          debug: { searchType: 'username_no_results', identifier, rawResult: users }
        };
      }
      
    } catch (error) {
      console.error('❌ EnhancedDoceboClient.getUserStatus error:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: { 
          searchType: type, 
          identifier, 
          error: error instanceof Error ? {
            message: error.message,
            stack: error.stack
          } : error
        }
      };
    }
  }
  
  async searchCourses(query: string, type: 'id' | 'title'): Promise<SearchResult> {
    console.log(`🔍 EnhancedDoceboClient.searchCourses called: ${query} (${type})`);
    
    try {
      if (type === 'id') {
        const courseId = parseInt(query);
        if (isNaN(courseId)) {
          return {
            found: false,
            message: `"${query}" is not a valid course ID. Please provide a numeric ID.`,
            debug: { searchType: 'course_id_invalid', query }
          };
        }
        
        const course = await super.getCourseById(courseId);
        console.log('📊 Course by ID result:', course);
        
        return {
          found: !!course,
          data: course ? [course] : [],
          debug: { searchType: 'course_id', query, courseId, rawResult: course }
        };
      } else {
        // Search by title
        console.log('🔍 Searching courses by title...');
        const courses = await super.searchCoursesByTitle(query);
        console.log('📊 Course search result:', courses);
        
        if (!courses.data || courses.data.length === 0) {
          // Try to find similar courses
          console.log('🔍 No direct matches, looking for similar courses...');
          const allCourses = await super.getCourses({ limit: 100 });
          console.log('📊 All courses for similarity search:', allCourses);
          
          const suggestions = this.findSimilarCourses(query, allCourses.data || []);
          
          if (suggestions.length > 0) {
            return {
              found: false,
              message: `No exact match found for "${query}". Here are similar courses:`,
              suggestions: suggestions,
              debug: { searchType: 'course_title_suggestions', query, suggestions, totalCourses: allCourses.data?.length }
            };
          }
          
          return {
            found: false,
            message: `No courses found matching "${query}". Try using the exact course name or ID.`,
            debug: { searchType: 'course_title_no_match', query, totalCourses: allCourses.data?.length }
          };
        }
        
        return {
          found: true,
          data: courses.data,
          debug: { searchType: 'course_title_found', query, resultCount: courses.data.length, rawResult: courses }
        };
      }
    } catch (error) {
      console.error('❌ EnhancedDoceboClient.searchCourses error:', error);
      return {
        found: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        debug: { searchType: 'course_error', query, error }
      };
    }
  }

  private findSimilarCourses(query: string, allCourses: any[]): any[] {
    const queryLower = query.toLowerCase();
    return allCourses
      .filter(course => {
        const nameLower = course.name?.toLowerCase() || '';
        return nameLower.includes(queryLower) || 
               this.calculateSimilarity(queryLower, nameLower) > 0.6;
      })
      .slice(0, 3);
  }
  
  private calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }
  
  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j - 1][i] + 1,
          matrix[j][i - 1] + 1, 
          matrix[j - 1][i - 1] + cost
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
}
