import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService, ResponseService } from "@libs/shared";
import type {
  UvDto,
  UpdateUvDto,
  PvDto,
  EventDto,
  ErrorDto,
  PerformanceDto,
} from "@en/common/tracker";

@Injectable()
export class TrackerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly response: ResponseService,
  ) {}

  // 创建/更新访客(UV)：同一 anonymousId 多次上报时 upsert，刷新浏览器/设备信息
  async createVisitor(dto: UvDto) {
    const visitor = await this.prisma.visitor.upsert({
      where: { anonymousId: dto.anonymousId },
      update: {
        browser: dto.browser,
        os: dto.os,
        device: dto.device,
        ...(dto.userId ? { userId: dto.userId } : {}),
      },
      create: {
        anonymousId: dto.anonymousId,
        ...(dto.userId ? { userId: dto.userId } : {}),
        browser: dto.browser,
        os: dto.os,
        device: dto.device,
      },
      select: {
        id: true,
        // anonymousId: true,
        // userId: true,
      },
    });
    return this.response.success(visitor.id);
  }

  // 更新访客的 userId（用户登录后关联匿名访客与真实用户）；visitorId 为 Visitor 表主键
  async updateVisitorUserId(dto: UpdateUvDto) {
    const visitor = await this.prisma.visitor.update({
      where: { id: dto.visitorId },
      data: { userId: dto.userId },
    });
    return this.response.success(visitor);
  }

  // 创建 PV 记录
  async createPageView(dto: PvDto) {
    const visitor = await this.ensureVisitor(dto.visitorId);
    const pageView = await this.prisma.pageView.create({
      data: {
        visitorId: visitor.id,
        url: dto.url,
        referrer: dto.referrer,
        path: dto.path,
      },
    });
    return this.response.success(pageView);
  }

  // 创建用户行为事件记录
  async createEvent(dto: EventDto) {
    const visitor = await this.ensureVisitor(dto.visitorId);
    const event = await this.prisma.trackEvent.create({
      data: {
        visitorId: visitor.id,
        event: dto.event,
        payload: dto.payload ? JSON.stringify(dto.payload) : null,
        url: dto.url,
      },
    });
    return this.response.success(event);
  }

  // 创建错误记录
  async createError(dto: ErrorDto) {
    const visitor = await this.ensureVisitor(dto.visitorId);
    const error = await this.prisma.errorEntry.create({
      data: {
        visitorId: visitor.id,
        errorType: dto.error,
        message: dto.message,
        stack: dto.stack,
        url: dto.url,
      },
    });
    return this.response.success(error);
  }

  // 创建性能指标记录
  async createPerformance(dto: PerformanceDto) {
    const visitor = await this.ensureVisitor(dto.visitorId);
    const performance = await this.prisma.performanceEntry.create({
      data: {
        visitorId: visitor.id,
        fp: dto.fp,
        fcp: dto.fcp,
        lcp: dto.lcp,
        inp: dto.inp,
        cls: dto.cls,
      },
    });
    return this.response.success(performance);
  }

  // 通过 Visitor 表主键 id 查找访客；正确流程下前端必先调 UV 接口拿到 id，查不到说明流程异常
  private async ensureVisitor(id: string) {
    const visitor = await this.prisma.visitor.findUnique({ where: { id } });
    if (!visitor) {
      throw new NotFoundException(`访客不存在: ${id}`);
    }
    return visitor;
  }
}
