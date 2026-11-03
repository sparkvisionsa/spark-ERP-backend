import { Body, Controller, Get, Post, Req, Res, UseGuards } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { Request, Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService, private readonly config: ConfigService) {}

  private lifetimeMilliseconds(value: string | undefined, fallback: number) {
    const match = /^(\d+)(s|m|h|d)$/.exec(value?.trim() || "");
    if (!match) return fallback;
    const scale = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[match[2] as "s" | "m" | "h" | "d"];
    return Number(match[1]) * scale;
  }

  private cookieOptions(maxAge: number) {
    const production = this.config.get("NODE_ENV") === "production";
    return { httpOnly: true, sameSite: production ? "none" as const : "lax" as const, secure: production, path: "/", maxAge };
  }

  private clearCookies(response: Response) {
    const production = this.config.get("NODE_ENV") === "production";
    const options = { httpOnly: true, sameSite: production ? "none" as const : "lax" as const, secure: production, path: "/" };
    response.clearCookie("spark_access", options);
    response.clearCookie("spark_refresh", options);
  }

  private setCookies(response: Response, tokens: { accessToken: string; refreshToken?: string }) {
    const accessMaxAge = this.lifetimeMilliseconds(this.config.get<string>("JWT_ACCESS_EXPIRES"), 24 * 60 * 60 * 1000);
    const refreshMaxAge = this.lifetimeMilliseconds(this.config.get<string>("JWT_REFRESH_EXPIRES"), 30 * 24 * 60 * 60 * 1000);
    response.cookie("spark_access", tokens.accessToken, this.cookieOptions(accessMaxAge));
    if (tokens.refreshToken) response.cookie("spark_refresh", tokens.refreshToken, this.cookieOptions(refreshMaxAge));
  }

  @Post("login")
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const result = await this.authService.login(dto);
    this.setCookies(response, result);
    return { user: result.user };
  }

  @Post("refresh")
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    try {
      const result = await this.authService.refresh(request.cookies?.spark_refresh);
      this.setCookies(response, result);
      return { user: result.user };
    } catch (error) {
      this.clearCookies(response);
      throw error;
    }
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) { return this.authService.me(user); }

  @Post("logout")
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(request.cookies?.spark_refresh);
    this.clearCookies(response);
    return { message: "تم تسجيل الخروج بنجاح" };
  }
}
