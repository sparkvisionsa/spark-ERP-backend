import { Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { NotificationsService } from "./notifications.service";

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("notifications")
@Controller("notifications")
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("limit") limit?: string) {
    return this.notifications.list(user.id, Number(limit));
  }

  @Patch("read-all")
  markAllRead(@CurrentUser() user: AuthUser) {
    return this.notifications.markAllRead(user.id);
  }

  @Patch("acknowledge-all")
  acknowledgeAll(@CurrentUser() user: AuthUser) {
    return this.notifications.acknowledgeAll(user.id);
  }

  @Patch(":id/acknowledge")
  acknowledge(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.acknowledge(id, user.id);
  }

  @Patch(":id/read")
  markRead(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    return this.notifications.markRead(id, user.id);
  }
}
