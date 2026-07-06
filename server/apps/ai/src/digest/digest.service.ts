import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaService } from "@libs/shared";
import dayjs from "dayjs";
import { tool } from "@langchain/core/tools";
import { createAgent } from "langchain";
import { createDeepSeek } from "../llm/llm.config";
import { ConfigService } from "@nestjs/config";
import marked from "marked";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { digestQueueName } from "./digest.queue";

@Injectable()
export class DigestService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(digestQueueName.name) private readonly digestQueue: Queue,
  ) {}
  private queryTool() {
    return tool(
      async ({ userId }: { userId: string }) => {
        const user = await this.prisma.user.findFirst({
          where: {
            id: userId,
          },
          select: {
            email: true,
            name: true,
            wordNumber: true,
            wordBookRecords: {
              where: {
                createdAt: {
                  gte: dayjs().startOf("day").toDate(),
                  lte: dayjs().add(1, "day").startOf("day").toDate(),
                },
              },
              select: {
                word: {
                  select: {
                    word: true,
                  },
                },
              },
            },
          },
        });
        // console.log(user);

        return user;
      },
      {
        name: "queryTool",
        description: "根据用户ID查询用户学习的单词记录",
        schema: {
          type: "object",
          properties: {
            userId: {
              type: "string",
              description: "用户ID",
            },
          },
          required: ["userId"],
        },
      },
    );
  }
  async onModuleInit() {
    await this.digestQueue.add(
      digestQueueName.task.everyDayDigest,
      {},
      {
        repeat: {
          pattern: "0 0 * * *",
        },
      },
    );
  }
  async handleEmailDigest() {
    // Initialization logic for the digest service
    // 1. 筛选高质量用户（打开定时任务 + 定时任务有时间 + 今天学过的单词 + 邮箱不为空）
    const users = await this.prisma.user.findMany({
      where: {
        isTimingTask: true,
        timingTaskTime: {
          not: "",
        },
        email: {
          not: null,
        },
        wordBookRecords: {
          some: {
            createdAt: {
              gte: dayjs().startOf("day").toDate(), // >= 今天的开始时间
              lte: dayjs().add(1, "day").startOf("day").toDate(), // < 明天的开始时间
            },
          },
        },
      },
      select: {
        id: true,
        timingTaskTime: true,
        email: true,
      },
    });
    for (const user of users) {
      // console.log("user===========", user);
      const userId = user.id;
      const agent = createAgent({
        model: createDeepSeek(this.config),
        tools: [this.queryTool()],
        systemPrompt:
          "你是一个单词记忆助手，根据用户信息和单词记录，生成单词记忆报告",
      });
      const result = await agent.invoke({
        messages: [
          {
            role: "user",
            content: `查询用户信息,并且根据用户id关联单词记录表，查询出用户今天的单词记录,用户id: ${userId}，过滤掉敏感信息`,
          },
        ],
      });
      const content = result.messages.at(-1)?.content;
      if (content) {
        const html = await marked.parse(content as string);
        const [hour, minute, second] = user.timingTaskTime
          .split(":")
          .map(Number);
        const target = dayjs()
          .startOf("day")
          .set("hour", hour)
          .set("minute", minute)
          .set("second", second);
        let delay = target.diff(dayjs());
        if (delay < 0) {
          delay = 0;
        }
        this.digestQueue.add(
          digestQueueName.task.emailDigest,
          {
            userId: user.id,
            text: html,
            email: user.email,
          },
          {
            delay: delay,
          },
        );
      }
    }
  }
}
