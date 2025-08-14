// app/api/debug-lp-structure/route.ts - Debug learning plan data structure
import { NextRequest, NextResponse } from 'next/server';

function getConfig() {
  return {
    domain: process.env.DOCEBO_DOMAIN!,
    clientId: process.env.DOCEBO_CLIENT_ID!,
    clientSecret: process.env.DOCEBO_CLIENT_SECRET!,
    username: process.env.DOCEBO_USERNAME!,
    password: process.env.DOCEBO_PASSWORD!,
  };
}

class LearningPlanStructureDebugAPI {
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

    console.log(`🔍 API Request: ${url}`);

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

  async analyzeLearningPlanStructure(): Promise<any> {
    console.log(`🔍 DEBUG: Analyzing learning plan data structure`);

    let analysisResult = {
      endpoint: '/learningplan/v1/learningplans',
      tests: [] as any[],
      dataStructure: {} as any,
      fieldAnalysis: {} as any,
      recommendations: [] as string[]
    };

    try {
      // Get first few learning plans
      console.log(`📋 Fetching learning plans for structure analysis`);
      const result = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: 5
      });
      
      analysisResult.tests.push({
        test: 'basic_fetch',
        success: true,
        itemsReturned: result.data?.items?.length || 0,
        hasData: !!result.data,
        hasItems: !!result.data?.items
      });

      if (result.data?.items?.length > 0) {
        const learningPlans = result.data.items;
        
        // Analyze data structure
        analysisResult.dataStructure = {
          totalPlans: learningPlans.length,
          responseStructure: {
            rootKeys: Object.keys(result),
            dataKeys: result.data ? Object.keys(result.data) : [],
            hasItems: !!result.data?.items,
            itemsIsArray: Array.isArray(result.data?.items)
          }
        };

        // Analyze fields in learning plans
        const allFields = new Set<string>();
        const fieldFrequency: Record<string, number> = {};
        const fieldTypes: Record<string, Set<string>> = {};
        const sampleValues: Record<string, any[]> = {};

        learningPlans.forEach((plan: any, index: number) => {
          Object.keys(plan).forEach(key => {
            allFields.add(key);
            fieldFrequency[key] = (fieldFrequency[key] || 0) + 1;
            
            if (!fieldTypes[key]) {
              fieldTypes[key] = new Set();
              sampleValues[key] = [];
            }
            
            const value = plan[key];
            fieldTypes[key].add(typeof value);
            
            if (sampleValues[key].length < 3) {
              sampleValues[key].push(value);
            }
          });
        });

        analysisResult.fieldAnalysis = {
          totalUniqueFields: allFields.size,
          allFields: Array.from(allFields).sort(),
          fieldFrequency,
          fieldTypes: Object.fromEntries(
            Object.entries(fieldTypes).map(([key, types]) => [key, Array.from(types)])
          ),
          sampleValues: Object.fromEntries(
            Object.entries(sampleValues).map(([key, values]) => [key, values.slice(0, 2)])
          )
        };

        // Detailed analysis of first learning plan
        const firstPlan = learningPlans[0];
        analysisResult.dataStructure.firstPlanDetails = {
          id: firstPlan.id || firstPlan.learning_plan_id || firstPlan.lp_id || 'NO_ID_FOUND',
          title: firstPlan.title || firstPlan.name || firstPlan.learning_plan_name || 'NO_TITLE_FOUND',
          status: firstPlan.status || firstPlan.learning_plan_status || firstPlan.lp_status || firstPlan.state || 'NO_STATUS_FOUND',
          enrollments: firstPlan.enrollment_count || firstPlan.enrolled_users || firstPlan.total_enrollments || firstPlan.user_count || 'NO_ENROLLMENT_DATA_FOUND',
          allProperties: Object.keys(firstPlan),
          fullObject: firstPlan
        };

        // Look for status-related fields
        const statusFields = Array.from(allFields).filter(field => 
          field.toLowerCase().includes('status') || 
          field.toLowerCase().includes('state') || 
          field.toLowerCase().includes('active') ||
          field.toLowerCase().includes('published')
        );

        // Look for enrollment-related fields
        const enrollmentFields = Array.from(allFields).filter(field => 
          field.toLowerCase().includes('enroll') || 
          field.toLowerCase().includes('user') || 
          field.toLowerCase().includes('count') ||
          field.toLowerCase().includes('total')
        );

        analysisResult.fieldAnalysis.statusFields = statusFields;
        analysisResult.fieldAnalysis.enrollmentFields = enrollmentFields;

        // Generate recommendations
        if (statusFields.length > 0) {
          analysisResult.recommendations.push(`✅ Found ${statusFields.length} status-related fields: ${statusFields.join(', ')}`);
        } else {
          analysisResult.recommendations.push('❌ No obvious status fields found');
        }

        if (enrollmentFields.length > 0) {
          analysisResult.recommendations.push(`✅ Found ${enrollmentFields.length} enrollment-related fields: ${enrollmentFields.join(', ')}`);
        } else {
          analysisResult.recommendations.push('❌ No obvious enrollment count fields found');
        }

        // Specific field recommendations
        if (firstPlan.id) {
          analysisResult.recommendations.push('✅ Use "id" field for learning plan ID');
        } else if (firstPlan.learning_plan_id) {
          analysisResult.recommendations.push('✅ Use "learning_plan_id" field for learning plan ID');
        }

        if (firstPlan.title) {
          analysisResult.recommendations.push('✅ Use "title" field for learning plan name');
        } else if (firstPlan.name) {
          analysisResult.recommendations.push('✅ Use "name" field for learning plan name');
        }

      } else {
        analysisResult.tests.push({
          test: 'no_data',
          success: false,
          message: 'No learning plans returned from API'
        });
      }
      
    } catch (error) {
      analysisResult.tests.push({
        test: 'api_error',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
    
    return analysisResult;
  }
}

let debugStructureApi: LearningPlanStructureDebugAPI;

export async function POST(request: NextRequest) {
  try {
    if (!debugStructureApi) {
      debugStructureApi = new LearningPlanStructureDebugAPI(getConfig());
    }
    
    console.log(`🔍 DEBUG: Starting learning plan structure analysis`);
    
    const analysisResult = await debugStructureApi.analyzeLearningPlanStructure();
    
    return NextResponse.json({
      message: `Learning plan structure analysis completed`,
      analysis: analysisResult,
      summary: {
        endpoint: '/learningplan/v1/learningplans',
        totalFields: analysisResult.fieldAnalysis?.totalUniqueFields || 0,
        statusFieldsFound: analysisResult.fieldAnalysis?.statusFields?.length || 0,
        enrollmentFieldsFound: analysisResult.fieldAnalysis?.enrollmentFields?.length || 0,
        recommendationsCount: analysisResult.recommendations?.length || 0
      }
    });
    
  } catch (error) {
    console.error('❌ Learning plan structure analysis error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Learning plan structure analysis failed'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Learning plan structure analysis endpoint',
    usage: 'POST to analyze the data structure of learning plans',
    purpose: 'Debug status and enrollment fields in learning plan API responses'
  });
}
