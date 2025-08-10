// lib/docebo-api-fixed.ts - Quick fix based on documentation
export class DoceboAPIFixed {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    this.baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    this.clientId = process.env.DOCEBO_CLIENT_ID!;
    this.clientSecret = process.env.DOCEBO_CLIENT_SECRET!;
    
    console.log('🔗 Fixed Docebo API Client initialized');
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    const response = await fetch(`${this.baseUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.clientId,
        client_secret: this.clientSecret,
        scope: 'api',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Auth failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    if (!data.access_token) {
      throw new Error('No access token received');
    }
    
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
    return this.accessToken;
  }

  // Fixed API call method - key changes from our original
  private async apiCall(endpoint: string, method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', body?: any): Promise<any> {
    const token = await this.getAccessToken();
    
    console.log(`📡 Fixed API Call: ${method} ${endpoint}`);
    
    // KEY FIX 1: Different headers for GET vs POST
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    };

    // KEY FIX 2: Only add Content-Type for POST/PUT with body
    if ((method === 'POST' || method === 'PUT') && body) {
      headers['Content-Type'] = 'application/json';
    }

    // KEY FIX 3: Don't add unnecessary headers for GET requests
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    console.log(`📊 Response: ${response.status} ${response.statusText}`);
    console.log(`📊 Content-Type: ${response.headers.get('content-type')}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      const responseText = await response.text();
      console.error(`❌ Non-JSON response: ${responseText.substring(0, 200)}`);
      throw new Error(`Expected JSON response, got: ${contentType}`);
    }

    const result = await response.json();
    console.log(`✅ API Success: ${method} ${endpoint}`);
    return result;
  }

  // Simple user search method
  async searchUsers(searchText: string = '', pageSize: number = 25): Promise<any> {
    const params = new URLSearchParams();
    
    // KEY FIX 4: Handle empty search text properly
    if (searchText && searchText.trim() !== '') {
      params.append('search_text', searchText.trim());
    }
    
    params.append('page_size', pageSize.toString());
    
    const endpoint = `/manage/v1/user?${params.toString()}`;
    return await this.apiCall(endpoint, 'GET');
  }

  // Simple user by ID method
  async getUserById(userId: string): Promise<any> {
    return await this.apiCall(`/manage/v1/user/${userId}`, 'GET');
  }

  // Health check
  async healthCheck(): Promise<any> {
    try {
      const result = await this.searchUsers('', 1);
      return {
        status: 'healthy',
        message: 'API working correctly',
        userCount: result?.data?.total_count || 0,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date()
      };
    }
  }
}
