import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  createCheckpoint,
  createDeepSeek,
  createBochaSearch,
} from "../llm/llm.config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import type { AIMessageChunk, ReactAgent } from "langchain";
import { ChatDto, ChatRoleType } from "@en/common/chat";
import { createAgent } from "langchain";
import { chatMode } from "../prompt/prompt.mode";
import { ResponseService } from "@libs/shared";

@Injectable()
export class ChatService implements OnModuleInit {
  private checkpointer!: PostgresSaver;

  constructor(
    private readonly configService: ConfigService,
    private readonly responseService: ResponseService,
  ) {}

  async streamCompletion(chatDto: ChatDto) {
    // 统一使用 v4-flash 模型，deepThink 仅控制是否开启/展示思考过程
    const model = createDeepSeek(this.configService, chatDto.deepThink);
    const findMode = chatMode.find((item) => item.role === chatDto.role);
    if (!findMode) {
      throw new Error("模式不存在");
    }
    let prompt = findMode.prompt; // 根据role获取对应的基础系统提示词prompt
    const content = chatDto.content; // 用户输入的content
    if (chatDto.webSearch) {
      const webSearchPrompt = await createBochaSearch(
        this.configService,
        content,
      );
      prompt += `请根据以下搜索结果回答问题：${webSearchPrompt}(并且返回你参考的网站名称)，用户问题：${content}`;
    }

    // 1. 通过role获取对应的Agent
    const agent = createAgent({
      model: model, //模型
      systemPrompt: prompt, //系统提示词
      checkpointer: this.checkpointer, //检查点
    });

    // 2. 组装消息格式
    const id = `${chatDto.userId}-${chatDto.role}`;
    const stream = agent.stream(
      {
        messages: [{ role: "human", content }],
      },
      {
        configurable: {
          thread_id: id, // 用于做会话隔离加历史记录存储
        },
        streamMode: "messages", // 流式输出模式
      },
    );
    return stream; // 返回一个迭代器
  }

  async getHistory(userId: string, role: ChatRoleType) {
    const messages = await this.checkpointer.get({
      configurable: {
        thread_id: `${userId}-${role}`,
      },
    });
    const list = messages?.channel_values?.messages as AIMessageChunk[];
    if (!list) return this.responseService.success([]);
    const result = list.map((message) => ({
      content: message.content,
      role: message.type as ChatRoleType,
      reasoning: message.additional_kwargs?.reasoning_content,
    }));
    return this.responseService.success(result);
  }
  async onModuleInit() {
    // 初始化检查点服务
    this.checkpointer = await createCheckpoint(this.configService);
  }
}
