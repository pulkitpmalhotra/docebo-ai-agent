// app/api/debug-learning-plans/route.ts - Debug learning plan endpoint functionality
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

class DebugLearningPlanAPI {
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

  async debugLearningPlans(searchText?: string): Promise<any> {
    console.log(`🔍 DEBUG: Testing learning plan endpoints`);

    let debugInfo = {
      endpoint: '/learningplan/v1/learningplans',
      searchText: searchText || 'test',
      tests: [] as any[],
      recommendations: [] as string[]
    };

    // Test 1: Basic endpoint
    try {
      console.log(`📋 Test 1: Basic endpoint call`);
      const basicResult = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: 5
      });
      
      debugInfo.tests.push({
        test: 'basic_endpoint',
        success: true,
        itemsReturned: basicResult.data?.items?.length || 0,
        totalAvailable: basicResult.data?.total_count || 0,
        hasMoreData: basicResult.data?.has_more_data || false,
        sampleData: basicResult.data?.items?.[0] || null,
        responseStructure: {
          hasData: !!basicResult.data,
          hasItems: !!basicResult.data?.items,
          dataKeys: basicResult.data ? Object.keys(basicResult.data) : [],
          firstItemKeys: basicResult.data?.items?.[0] ? Object.keys(basicResult.data.items[0]) : []
        }
      });
      
    } catch (error) {
      debugInfo.tests.push({
        test: 'basic_endpoint',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: With search text
    if (searchText) {
      try {
        console.log(`📋 Test 2: Search with text "${searchText}"`);
        const searchResult = await this.apiRequest('/learningplan/v1/learningplans', {
          search_text: searchText,
          page_size: 10
        });
        
        debugInfo.tests.push({
          test: 'search_text',
          success: true,
          searchText: searchText,
          itemsReturned: searchResult.data?.items?.length || 0,
          totalAvailable: searchResult.data?.total_count || 0,
          matches: searchResult.data?.items?.map((item: any) => ({
            id: item.id,
            name: item.title || item.name,
            description: item.description ? item.description.substring(0, 100) + '...' : 'No description'
          })) || []
        });
        
      } catch (error) {
        debugInfo.tests.push({
          test: 'search_text',
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Test 3: Different parameters
    try {
      console.log(`📋 Test 3: With sorting parameters`);
      const sortedResult = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: 5,
        sort_attr: 'title',
        sort_dir: 'asc'
      });
      
      debugInfo.tests.push({
        test: 'with_sorting',
        success: true,
        itemsReturned: sortedResult.data?.items?.length || 0,
        sortedTitles: sortedResult.data?.items?.map((item: any) => 
          item.title || item.name || 'Untitled'
        ) || []
      });
      
    } catch (error) {
      debugInfo.tests.push({
        test: 'with_sorting',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 4: Try old endpoint for comparison
    try {
      console.log(`📋 Test 4: Testing old endpoint /learn/v1/lp`);
      const oldResult = await this.apiRequest('/learn/v1/lp', {
        page_size: 5
      });
      
      debugInfo.tests.push({
        test: 'old_endpoint',
        success: true,
        itemsReturned: oldResult.data?.items?.length || 0,
        note: 'Old endpoint still works'
      });
      
    } catch (error) {
      debugInfo.tests.push({
        test: 'old_endpoint',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        note: 'Old endpoint no longer works - confirmed need for new endpoint'
      });
    }

    // Test 5: Alternative parameters
    try {
      console.log(`📋 Test 5: Testing alternative search patterns`);
      const altResult = await this.apiRequest('/learningplan/v1/learningplans', {
        page_size: 10,
        sort_attr: 'id',
        sort_dir: 'desc'
      });
      
      debugInfo.tests.push({
        test: 'alternative_params',
        success: true,
        itemsReturned: altResult.data?.items?.length || 0,
        sortField: 'id',
        sortDirection: 'desc'
      });
      
    } catch (error) {
      debugInfo.tests.push({
        test: 'alternative_params',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Generate recommendations
    const successfulTests = debugInfo.tests.filter(t => t.success);
    if (successfulTests.length > 0) {
      debugInfo.recommendations.push('✅ Learning plan endpoint /learningplan/v1/learningplans is working');
      
      const basicTest = successfulTests.find(t => t.test === 'basic_endpoint');
      if (basicTest && basicTest.itemsReturned > 0) {
        debugInfo.recommendations.push(`✅ Found ${basicTest.itemsReturned} learning plans available`);
        debugInfo.recommendations.push('✅ Basic endpoint returns data successfully');
      }
      
      if (successfulTests.some(t => t.test === 'search_text' && t.itemsReturned > 0)) {
        debugInfo.recommendations.push('✅ search_text parameter works correctly');
      } else if (successfulTests.some(t => t.test === 'search_text')) {
        debugInfo.recommendations.push('⚠️ search_text parameter works but returned no results - use manual filtering');
      }
      
      if (successfulTests.some(t => t.test === 'with_sorting')) {
        debugInfo.recommendations.push('✅ sort_attr and sort_dir parameters work');
      }

      const oldEndpointTest = debugInfo.tests.find(t => t.test === 'old_endpoint');
      if (oldEndpointTest && !oldEndpointTest.success) {
        debugInfo.recommendations.push('✅ Confirmed: Old endpoint /learn/v1/lp is no longer available');
        debugInfo.recommendations.push('✅ New endpoint /learningplan/v1/learningplans is the correct replacement');
      }
      
    } else {
      debugInfo.recommendations.push('❌ Learning plan endpoint may not be available');
      debugInfo.recommendations.push('🔍 Check API permissions and endpoint availability');
      debugInfo.recommendations.push('🔍 Verify authentication credentials');
    }
    
    // Add implementation recommendations
    debugInfo.recommendations.push('');
    debugInfo.recommendations.push('📋 Implementation Recommendations:');
    debugInfo.recommendations.push('• Use /learningplan/v1/learningplans for all learning plan operations');
    debugInfo.recommendations.push('• Include sort_attr=title and sort_dir=asc for consistent ordering');
    debugInfo.recommendations.push('• Test search_text parameter but have manual filtering as fallback');
    debugInfo.recommendations.push('• Use reasonable page_size (50-200) to avoid timeouts');
    
    return debugInfo;
  }
}

let debugLpApi: DebugLearningPlanAPI;

export async function POST(request: NextRequest) {
  try {
    if (!debugLpApi) {
      debugLpApi = new DebugLearningPlanAPI(getConfig());
    }

    const body = await request.json();
    const { searchText } = body;
    
    console.log(`🔍 DEBUG: Testing learning plans${searchText ? ` with search: ${searchText}` : ''}`);
    
    const debugInfo = await debugLpApi.debugLearningPlans(searchText);
    
    return NextResponse.json({
      message: `Learning plan debug completed`,
      debugInfo: debugInfo,
      summary: {
        endpointTested: '/learningplan/v1/learningplans',
        testsRun: debugInfo.tests.length,
        successfulTests: debugInfo.tests.filter((t: any) => t.success).length,
        failedTests: debugInfo.tests.filter((t: any) => !t.success).length,
        oldEndpointStatus: debugInfo.tests.find((t: any) => t.test === 'old_endpoint')?.success ? 'still_works' : 'deprecated',
        newEndpointStatus: debugInfo.tests.find((t: any) => t.test === 'basic_endpoint')?.success ? 'working' : 'failed'
      },
      recommendations: debugInfo.recommendations
    });
    
  } catch (error) {
    console.error('❌ Learning plan debug error:', error);
    
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Learning plan debug failed',
      systemError: true
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Learning plan debug endpoint',
    usage: 'POST with {"searchText": "optional search term"}',
    endpoints_tested: [
      '/learningplan/v1/learningplans (new)',
      '/learn/v1/lp (old - for comparison)'
    ],
    test_cases: [
      'basic_endpoint - Test basic functionality',
      'search_text - Test search parameter',
      'with_sorting - Test sorting parameters',
      'old_endpoint - Compare with deprecated endpoint',
      'alternative_params - Test different parameter combinations'
    ],
    recommended_usage: {
      endpoint: '/learningplan/v1/learningplans',
      parameters: {
        search_text: 'Search term (may need manual filtering fallback)',
        page_size: 'Number of results (recommend 50-200)',
        sort_attr: 'Field to sort by (recommend "title")',
        sort_dir: 'Sort direction (recommend "asc")'
      }
    }
  });
}
