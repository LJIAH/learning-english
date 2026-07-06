import { AccessTokenPayload } from "@en/common/user";

declare global {
  namespace Express {
    export interface Request {
      user: AccessTokenPayload;
    }
  }
}
