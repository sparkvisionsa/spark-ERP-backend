import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { AnalyticsQueryDto } from "./dto/analytics-query.dto";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("overview")
  overview(@CurrentUser() user: AuthUser, @Query() query: AnalyticsQueryDto) {
    return this.analyticsService.overview(user, query.company, query.days);
  }
}
