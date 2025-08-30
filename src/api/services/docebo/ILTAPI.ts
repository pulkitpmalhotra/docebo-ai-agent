import { BaseAPI } from './BaseAPI';
import { ILTSession } from '../../../domain/entities/ILTSession';

export class ILTAPI extends BaseAPI {
  async getILTSession(id: number): Promise<ILTSession> {
    const response = await this.get(`/learn/v1/ilt/sessions/${id}`);
    return response.data;
  }

  async searchILTSessions(query: string): Promise<ILTSession[]> {
    const response = await this.get('/learn/v1/ilt/sessions', { params: { search_text: query } });
    return response.data.items;
  }

  async createILTSession(iltSession: Partial<ILTSession>): Promise<ILTSession> {
    const response = await this.post('/learn/v1/ilt/sessions', iltSession);
    return response.data;
  }

  // Add more ILT-related methods as needed
}
