import { UsersAPI } from '../docebo/UsersAPI';

export class UserService {
  private usersAPI: UsersAPI;

  constructor() {
    this.usersAPI = new UsersAPI();
  }

  async getUsers(params: any) {
    return this.usersAPI.getUsers(params);
  }

  async getUser(id: number) {
    return this.usersAPI.getUser(id);
  }

  async createUser(data: any) {
    return this.usersAPI.createUser(data);
  }

  async updateUser(id: number, data: any) {
    return this.usersAPI.updateUser(id, data);
  }

  async deleteUser(id: number) {
    return this.usersAPI.deleteUser(id);
  }
}
