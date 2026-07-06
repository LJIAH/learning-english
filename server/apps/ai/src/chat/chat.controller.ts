import { Controller, Get, Post, Body, Res, Query } from "@nestjs/common";
import type { Response } from "express";
import { ChatService } from "./chat.service";
import type { ChatDto, ChatRoleType } from "@en/common/chat";

@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post()
  async streamCompletion(@Body() chatDto: ChatDto, @Res() res: Response) {
    // 设置返回的格式，SSE流式输出
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    const stream = await this.chatService.streamCompletion(chatDto);
    for await (const chunk of stream) {
      const [msg] = chunk;
      const thinkMsg = msg.additional_kwargs?.reasoning_content ?? "";
      // 仅在用户开启深度思考时输出思考过程，避免普通模型(v4-flash)自带的 reasoning 也被推送
      if (thinkMsg && chatDto.deepThink) {
        res.write(
          `data: ${JSON.stringify({ content: thinkMsg, role: "ai", type: "reasoning" })}\n\n`,
        );
      }
      const content = msg.content;
      if (content) {
        res.write(
          `data: ${JSON.stringify({ content: content, role: "ai", type: "chat" })}\n\n`,
        );
      }
    }
    res.end();
  }

  @Get("history")
  getHistory(
    @Query("userId") userId: string,
    @Query("role") role: ChatRoleType,
  ) {
    return this.chatService.getHistory(userId, role);
  }
}
