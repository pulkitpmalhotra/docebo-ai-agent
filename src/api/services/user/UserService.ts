import { UsersAPI } from '../docebo/UsersAPI';
import { User } from '../../../domain/entities/User';

export class UserService {
  private usersAPI: UsersAPI;

  constructor() {
    this.usersAPI = new UsersAPI();
  }

  async getUser(userId: number) {
    return this.usersAPI.getUser(userId);
  }

  async searchUsers(query: string) {
    return this.usersAPI.searchUsers(query);
  }

  async createUser(user: Partial<User>) {
    // Assuming there's an API endpoint for creating users
    // return this.usersAPI.createUser(user);
    throw new Error('Not implemented');
  }

  async updateUser(userId: number, updatedUser: Partial<User>) {
    // Assuming there's an API endpoint for updating users
    // return this.usersAPI.updateUser(userId, updatedUser);
    throw new Error('Not implemented');
  }

  // Add more user-related methods as needed
}
