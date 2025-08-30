import { ILTAPI } from '../docebo/ILTAPI';
import { UsersAPI } from '../docebo/UsersAPI';
import { ILTSession } from '../../../domain/entities/ILTSession';

export class ILTService {
  private iltAPI: ILTAPI;
  private usersAPI: UsersAPI;

  constructor() {
    this.iltAPI = new ILTAPI();
    this.usersAPI = new UsersAPI();
  }

  async createILTSession(iltSession: Partial<ILTSession>) {
    return this.iltAPI.createILTSession(iltSession);
  }

  async getILTSession(sessionId: number) {
    return this.iltAPI.getILTSession(sessionId);
  }

  async searchILTSessions(query: string) {
    return this.iltAPI.searchILTSessions(query);
  }

  async addUserToILTSession(sessionId: number, userId: number) {
    const user = await this.usersAPI.getUser(userId);
    const session = await this.iltAPI.getILTSession(sessionId);

    if (!user || !session) {
      throw new Error('Invalid user or ILT session');
    }

    // Add the user to the ILT session
    // (Assuming there's an API endpoint for this)
    // await this.iltAPI.addUserToSession(sessionId, userId);

    return session;
  }

  // Add more ILT-related methods as needed
}
