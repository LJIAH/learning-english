import { PrismaService } from "@libs/shared";
import { Injectable } from "@nestjs/common";

@Injectable()
export class AppService {
  constructor(private readonly prismaService: PrismaService) {}
  getHello(): string {
    return "Hello World!";
  }
}
