import { MockDoceboClient } from './docebo-mock';

export class DoceboClient {
  private baseUrl: string;
  private clientId: string;
  private clientSecret: string;
  private accessToken?: string;
  private tokenExpiry?: Date;
  private useMock: boolean;
  private mockClient: MockDoceboClient;

  constructor() {
    this.baseUrl = `https://${process.env.DOCEBO_DOMAIN}`;
    this.clientId = process.env.DOCEBO_CLIENT_ID!;
    this.clientSecret = process.env.DOCEBO_CLIENT_SECRET!;
    
    // Force mock mode for sandbox or when explicitly set
    this.useMock = true; // Always use mock for now
    
    console.log('🎭 Docebo Client initialized in MOCK mode');
    this.mockClient = new MockDoceboClient();
  }

  async getUsers(params: { limit?: number; search?: string } = {}) {
    return this.mockClient.getUsers(params);
  }

  async getCourses(params: { limit?: number; search?: string } = {}) {
    return this.mockClient.getCourses(params);
  }

  async getEnrollments(userId: number) {
    return this.mockClient.getEnrollments(userId);
  }

  async healthCheck() {
    return this.mockClient.healthCheck();
  }

  async enrollUser(userId: number, courseId: number, dry_run: boolean = true) {
    return this.mockClient.enrollUser(userId, courseId, dry_run);
  }

  // Keep the real API methods for future use
  private async getAccessToken(): Promise<string> {
    if (this.useMock) return 'mock-token';
    
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
      throw new Error(`Docebo auth failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.access_token || typeof data.access_token !== 'string') {
      throw new Error('Invalid access token received from Docebo API');
    }
    
    this.accessToken = data.access_token;
    this.tokenExpiry = new Date(Date.now() + (data.expires_in * 1000));
    
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
}
