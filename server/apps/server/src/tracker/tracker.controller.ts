import { Controller, Post, Body } from "@nestjs/common";
import { TrackerService } from "./tracker.service";
import type {
  UvDto,
  UpdateUvDto,
  PvDto,
  EventDto,
  ErrorDto,
  PerformanceDto,
} from "@en/common/tracker";

@Controller("tracker")
export class TrackerController {
  constructor(private readonly trackerService: TrackerService) {}

  // UV 上报：创建/更新访客
  @Post("uv")
  createVisitor(@Body() dto: UvDto) {
    return this.trackerService.createVisitor(dto);
  }

  // UV 更新：关联访客与登录用户
  @Post("update-uv")
  updateVisitorUserId(@Body() dto: UpdateUvDto) {
    return this.trackerService.updateVisitorUserId(dto);
  }

  // PV 上报：页面访问记录
  @Post("pv")
  createPageView(@Body() dto: PvDto) {
    return this.trackerService.createPageView(dto);
  }

  // 事件上报：用户行为记录
  @Post("event")
  createEvent(@Body() dto: EventDto) {
    return this.trackerService.createEvent(dto);
  }

  // 错误上报：JS / Promise 错误记录
  @Post("error")
  createError(@Body() dto: ErrorDto) {
    return this.trackerService.createError(dto);
  }

  // 性能上报：Web Vitals 指标记录
  @Post("performance")
  createPerformance(@Body() dto: PerformanceDto) {
    return this.trackerService.createPerformance(dto);
  }
}
