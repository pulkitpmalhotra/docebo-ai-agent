export class ChatController {
  private chatService: ChatService;

  constructor() {
    this.chatService = new ChatService();
  }

  async processMessage(message: string): Promise<ChatResponse> {
    // Delegate to the ChatService and format the response
    // ...
  }

  async getChatInfo(): Promise<ChatInfo> {
    // Get general chat info from the ChatService
    // ...
  }
}
