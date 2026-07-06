import { Injectable } from "@nestjs/common";
const Business = {
  SUCCESS: {
    code: 200,
    message: "success",
  },
  ERROR: {
    code: 500,
    message: "error",
  },
};
@Injectable()
export class ResponseService {
  success<T>(data: T) {
    return {
      data,
      code: Business.SUCCESS.code,
      message: Business.SUCCESS.message,
    };
  }
  error<T = null>(
    data: T = null as T,
    message?: string,
    code: number = Business.ERROR.code,
  ) {
    return {
      data,
      code,
      message: message || Business.ERROR.message,
    };
  }
}
