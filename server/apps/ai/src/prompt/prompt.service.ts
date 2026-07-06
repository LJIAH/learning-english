import { Injectable } from "@nestjs/common";
import { chatMode } from "./prompt.mode";
import { ResponseService } from "@libs/shared";

@Injectable()
export class PromptService {
  constructor(private readonly responseService: ResponseService) {}
  findAll() {
    return this.responseService.success(
      chatMode.map((item) => {
        return {
          role: item.role,
          label: item.label,
          id: item.id,
        };
      }),
    );
  }
}
