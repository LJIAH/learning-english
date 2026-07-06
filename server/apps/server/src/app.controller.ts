import { Controller, Get } from "@nestjs/common";
import { AppService } from "./app.service";
import { ResponseService } from "@libs/shared";

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly response: ResponseService,
  ) {}

  @Get()
  getHello() {
    return this.response.success(this.appService.getHello());
    return this.appService.getHello();
  }
}
