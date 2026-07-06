import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { JwtService } from "@nestjs/jwt";
import type { AccessTokenPayload } from "@en/common/user";
import type { Request } from "express";

// 路由守卫的作用是进行权限验证，例如验证用户是否登录，是否具有访问某个资源的权限，是否具有执行某个操作的权限。它可以在控制器方法、控制器类或模块上使用。例如，可以使用路由守卫来保护一个控制器，使其只能被登录用户访问。
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const headers = request.headers;
    if (!headers.authorization) {
      throw new UnauthorizedException("请登录");
    }
    const token = request.headers["authorization"]?.split(" ")[1];
    if (!token) return false;
    try {
      const payload = this.jwtService.verify<AccessTokenPayload>(token);
      if (payload.tokenType !== "access") {
        throw new UnauthorizedException("token 已经过期或无效");
      }
      // 将user信息添加到request中,这样做的目的是为了让后面的controller可以获取当前用户的信息
      request.user = payload;
      // console.log(payload);
    } catch {
      throw new UnauthorizedException("token 已经过期或无效");
    }
    return true;
  }
}
