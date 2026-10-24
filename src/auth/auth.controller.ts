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

  private cookieOptions(maxAge: number) {
    return { httpOnly: true, sameSite: "lax" as const, secure: this.config.get("NODE_ENV") === "production", path: "/", maxAge };
  }

  private setCookies(response: Response, tokens: { accessToken: string; refreshToken: string }) {
    response.cookie("spark_access", tokens.accessToken, this.cookieOptions(15 * 60 * 1000));
    response.cookie("spark_refresh", tokens.refreshToken, this.cookieOptions(7 * 24 * 60 * 60 * 1000));
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
    const result = await this.authService.refresh(request.cookies?.spark_refresh);
    this.setCookies(response, result);
    return { user: result.user };
  }

  @Get("me")
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthUser) { return this.authService.me(user); }

  @Post("logout")
  @UseGuards(JwtAuthGuard)
  async logout(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) response: Response) {
    await this.authService.logout(user.id);
    response.clearCookie("spark_access", { path: "/" });
    response.clearCookie("spark_refresh", { path: "/" });
    return { message: "تم تسجيل الخروج بنجاح" };
  }
}
