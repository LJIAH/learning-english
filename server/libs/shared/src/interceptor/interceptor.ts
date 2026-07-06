import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Request } from "express";
import { map, Observable } from "rxjs";

// 将bigint转换为字符串，并保留日期类型不变
const transformBigInt = (obj: unknown): unknown => {
  if (typeof obj === "bigint") {
    return obj.toString();
  }
  if (Array.isArray(obj)) {
    return obj.map((item: unknown) => transformBigInt(item));
  }
  if (obj !== null && typeof obj === "object") {
    if (obj instanceof Date) {
      return obj;
    }
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [key, transformBigInt(value)]),
    );
  }
  return obj;
};

@Injectable()
export class InterceptorInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    return next.handle().pipe(
      map((data: Record<string, unknown>) => {
        return {
          timestamp: new Date().toISOString(),
          path: request.url,
          message: (data?.message as string) || "请求成功",
          code: (data?.code as number) || 200,
          success: true,
          data: transformBigInt(data?.data) ?? null,
        };
      }),
    );
  }
}
