import { ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  canActivate(context: ExecutionContext) { return super.canActivate(context); }
  handleRequest<TUser = any>(error: any, user: any): TUser {
    if (error || !user) throw error || new UnauthorizedException("يجب تسجيل الدخول أولاً");
    return user;
  }
}
