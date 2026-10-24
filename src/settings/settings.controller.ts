import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { ChangePasswordDto, UpdatePreferencesDto, UpdateProfileDto, UpdateSystemSettingsDto } from "./dto/settings.dto";
import { SettingsService } from "./settings.service";

@ApiTags("settings")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("settings")
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  get(@CurrentUser() user: AuthUser) { return this.settingsService.get(user); }

  @Patch("system")
  @Roles(Role.SUPER_ADMIN)
  updateSystem(@CurrentUser() user: AuthUser, @Body() dto: UpdateSystemSettingsDto) { return this.settingsService.updateSystem(user, dto); }

  @Patch("preferences")
  updatePreferences(@CurrentUser() user: AuthUser, @Body() dto: UpdatePreferencesDto) { return this.settingsService.updatePreferences(user, dto); }

  @Patch("profile")
  updateProfile(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto) { return this.settingsService.updateProfile(user, dto); }

  @Post("change-password")
  changePassword(@CurrentUser() user: AuthUser, @Body() dto: ChangePasswordDto) { return this.settingsService.changePassword(user, dto); }
}
