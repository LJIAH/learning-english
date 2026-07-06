import { Controller, Get, Req, UseGuards } from "@nestjs/common";
import { CourseService } from "./course.service";
import type { Request } from "express";
import { AuthGuard } from "@libs/shared/auth/auth.guard";

@Controller("course")
export class CourseController {
  constructor(private readonly courseService: CourseService) {}
  @Get("list")
  findAll() {
    return this.courseService.findAll();
  }
  @UseGuards(AuthGuard)
  @Get("my")
  findMy(@Req() req: Request) {
    return this.courseService.findMy(req.user.userId);
  }
}
