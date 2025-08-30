import { BaseAPI } from './BaseAPI';
import { User } from '../../../domain/entities/User';

export class UsersAPI extends BaseAPI {
  async getUser(id: number): Promise<User> {
    const response = await this.get(`/manage/v1/user/${id}`);
    return response.data;
  }

  async searchUsers(query: string): Promise<User[]> {
    const response = await this.get('/manage/v1/user', { params: { search_text: query } });
    return response.data.items;
  }

  // Add more user-related methods as needed
}
