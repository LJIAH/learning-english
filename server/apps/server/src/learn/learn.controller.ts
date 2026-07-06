import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
} from "@nestjs/common";
import { LearnService } from "./learn.service";
import { AuthGuard } from "@libs/shared/auth/auth.guard";
import type { Request } from "express";

@Controller("learn")
export class LearnController {
  constructor(private readonly learnService: LearnService) {}

  @UseGuards(AuthGuard)
  @Post("word/master")
  saveWordMaster(
    @Body() { wordIds }: { wordIds: string[] },
    @Req() req: Request,
  ) {
    const userId = req.user.userId;
    return this.learnService.saveWordMaster(wordIds, userId);
  }

  @UseGuards(AuthGuard)
  @Get("word/:id")
  getWordList(@Param("id") id: string, @Req() req: Request) {
    const userId = req.user.userId;
    return this.learnService.getWordList(id, userId);
  }
}
