import { PrismaService, ResponseService } from "@libs/shared";
import { Injectable } from "@nestjs/common";

@Injectable()
export class LearnService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) {}

  // 保存单词到 wordBookRecord
  async saveWordMaster(wordIds: string[], userId: string) {
    // 保存单词到单词记录表
    const wordBookRecords = wordIds.map((wordId) => ({
      wordId,
      userId,
      isMaster: true,
    }));
    await this.prisma.wordBookRecord.createMany({
      data: wordBookRecords,
    });
    //更新用户学习单词的数量
    const user = await this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        wordNumber: {
          increment: wordIds.length, // 10
        },
      },
    });
    return this.response.success({
      wordNumber: user.wordNumber, //学习完单词的数量
    });
  }
  // 获取单词列表
  async getWordList(id: string, userId: string) {
    // 1. 如果没有买过课程，进入这个页面属于非法请求
    const courseRecord = await this.prisma.courseRecord.findFirst({
      where: {
        userId,
        courseId: id,
        isPurchased: true,
      },
      include: {
        course: true,
      },
    });
    if (!courseRecord) {
      return this.response.error("", "课程不存在");
    }
    const courseType = courseRecord.course.value;
    const words = await this.prisma.wordBook.findMany({
      where: {
        [courseType]: true,
        // 已经掌握的单词不能被查出来
        wordBookRecords: {
          none: {
            userId,
            isMaster: true,
          },
        },
      },
      skip: 0,
      take: 10,
      orderBy: {
        frq: "desc", // 排序频率越高越靠前
      },
    });
    return this.response.success(words);
  }
}
