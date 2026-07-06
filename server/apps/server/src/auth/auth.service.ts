import { Injectable } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import type {
  TokenPayload,
  Token,
  AccessTokenPayload,
  RefreshTokenPayload,
} from "@en/common/user";

@Injectable()
export class AuthService {
  constructor(private readonly jwtService: JwtService) {}
  generateToken(payload: TokenPayload): Token {
    // sing创建两个token，
    // accessToken, 验证token，过期时间是很快的
    // refreshToken, 刷新token，过期时间是7天
    // 一会需要提供刷新token的接口，refreshToken->accessToken
    // payload荷载可以让开发者自定义信息，比如{userId, name, email}
    // tokenType: access | refresh, 用于标识token的类型，这样做的目的是为了防止accessToken和refreshToken互相冒充
    return {
      accessToken: this.jwtService.sign<AccessTokenPayload>(
        {
          ...payload,
          tokenType: "access",
        },
        // 显式指定过期时间，避免依赖全局默认值导致意图不明确
        { expiresIn: "15m" },
      ),
      refreshToken: this.jwtService.sign<RefreshTokenPayload>(
        {
          ...payload,
          tokenType: "refresh",
        },
        { expiresIn: "7d" },
      ),
    };
  }
}
