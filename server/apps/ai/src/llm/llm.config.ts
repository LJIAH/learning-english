import { ChatDeepSeek } from "@langchain/deepseek";
import { ConfigService } from "@nestjs/config";
import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
// 统一使用 deepseek-v4-flash 模型
// deepThink=false 时按需降低 maxTokens；true 时留足空间容纳思考过程
export const createDeepSeek = (
  configService: ConfigService,
  deepThink = false,
) => {
  return new ChatDeepSeek({
    apiKey: configService.get<string>("DEEPSEEK_API_KEY"),
    model: configService.get<string>("DEEPSEEK_API_MODEL"),
    temperature: 1.3,
    maxTokens: deepThink ? 18000 : 4396,
    streaming: true,
    // DeepSeek V4 默认开启思考模式并消耗 reasoning token；
    // deepThink=false 时显式 disabled 关闭思考以节省费用，true 时 enabled 并展示过程
    modelKwargs: {
      thinking: { type: deepThink ? "enabled" : "disabled" },
    },
  });
};
// 初始化checkpoint
export const createCheckpoint = async (configService: ConfigService) => {
  const checkpointer = PostgresSaver.fromConnString(
    configService.get<string>("AI_DATABASE_URL")!,
  );
  await checkpointer.setup();
  return checkpointer;
};
// 初始化博查搜索API
export const createBochaSearch = async (
  configService: ConfigService,
  query: string,
  count: number = 10,
) => {
  const result = await fetch(
    `${configService.get<string>("BOCHA_SEARCH_URL")}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${configService.get<string>("BOCHA_API_KEY")}`,
      },
      body: JSON.stringify({
        query, // 搜索关键词
        count, // 返回数量
        summary: true, // 是否返回摘要
      }),
    },
  );
  const { data } = await result.json();
  const values = data.webPages.value;
  type Item = {
    name: string;
    url: string;
    summary: string;
    siteName: string;
    dateLastCrawled: string;
  };
  const prompt: string = values
    .map(
      (item: Item) => `
       标题：${item.name}
       链接：${item.url}
       摘要：${item?.summary?.replace(/\n/g, "") ?? ""}
       网站名称：${item.siteName}
       发布时间：${item.dateLastCrawled}
    `,
    )
    .join("\n");
  // console.log(prompt);
  return prompt;
};
