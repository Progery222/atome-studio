import { Body, Controller, Post } from "@nestjs/common";
import { ChatService } from "./chat.service";

interface ChatBody {
  session_id: string;
  text: string;
}

@Controller("chat")
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Post("message")
  async message(@Body() body: ChatBody) {
    if (!body?.session_id || !body?.text) {
      return { reply: "session_id и text обязательны", toolCalls: [] };
    }
    try {
      return await this.chat.send(body.session_id, body.text);
    } catch (e) {
      return { reply: `⚠ ${(e as Error).message}`, toolCalls: [] };
    }
  }

  @Post("reset")
  reset(@Body() body: { session_id: string }) {
    this.chat.reset(body.session_id);
    return { ok: true };
  }
}
