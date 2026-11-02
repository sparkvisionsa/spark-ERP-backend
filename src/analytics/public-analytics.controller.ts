import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import { AnalyticsService } from "./analytics.service";

@ApiTags("analytics")
@Controller("analytics")
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get("public-summary")
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  publicSummary() {
    return this.analyticsService.publicSummary();
  }
}
