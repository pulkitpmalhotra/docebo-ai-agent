import { ILTAPI } from '../docebo/ILTAPI';

export class ILTService {
  private iltAPI: ILTAPI;

  constructor() {
    this.iltAPI = new ILTAPI();
  }

  async getILTSessions(params: any) {
    return this.iltAPI.getILTSessions(params);
  }

  async getILTSession(id: number) {
    return this.iltAPI.getILTSession(id);
  }

  async createILTSession(data: any) {
    return this.iltAPI.createILTSession(data);
  }

  async updateILTSession(id: number, data: any) {
    return this.iltAPI.updateILTSession(id, data);
  }

  async deleteILTSession(id: number) {
    return this.iltAPI.deleteILTSession(id);
  }
}
