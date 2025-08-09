export class DoceboClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: Date;

  constructor() {
    this.baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    this.clientId = process.env.DOCEBO_CLIENT_ID!;
    this.clientSecret = process.env.DOCEBO_CLIENT_SECRET!;
  }

  private async getAccessToken(): Promise<string> {
    // Return existing token if still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    // Get new token
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
      throw new Error(`Docebo auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Invalid access token received from Docebo API');
    }
    
    // Store the token and expiry
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
    // Return the token we just set (now guaranteed to be a string)
    return data.access_token;
  }

  private async apiCall(endpoint: string, method: string = 'GET', body?: any) {
    const token = await this.getAccessToken();
    
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Docebo API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    return response.json();
  }

  // Safe read operations
  async getUsers(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/manage/v1/users?${queryParams}`);
  }

  async getCourses(params: { limit?: number; search?: string } = {}) {
    const queryParams = new URLSearchParams();
    if (params.limit) queryParams.append('limit', params.limit.toString());
    if (params.search) queryParams.append('search', params.search);
    
    return this.apiCall(`/learn/v1/courses?${queryParams}`);
  }

  async getEnrollments(userId: number) {
    return this.apiCall(`/learn/v1/enrollments?user_id=${userId}`);
  }

  // Health check for testing
  async healthCheck() {
    try {
      await this.apiCall('/manage/v1/user/me');
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { status: 'unhealthy', error: errorMessage, timestamp: new Date() };
    }
  }
}
