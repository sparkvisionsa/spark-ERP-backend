import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateSystemSettingsDto {
  @IsOptional() @IsString() @MinLength(2) systemName?: string;
  @IsOptional() @IsIn(["Asia/Riyadh"]) timezone?: string;
  @IsOptional() @IsIn(["ar-SA"]) locale?: string;
  @IsOptional() @IsIn(["DD/MM/YYYY", "YYYY/MM/DD"]) dateFormat?: string;
  @IsOptional() @IsBoolean() showPercentages?: boolean;
  @IsOptional() @IsBoolean() rememberLastProject?: boolean;
  @IsOptional() @IsBoolean() confirmSensitiveActions?: boolean;
}

export class UpdatePreferencesDto {
  @IsOptional() @IsBoolean() notificationsEnabled?: boolean;
  @IsOptional() @IsBoolean() taskNotifications?: boolean;
  @IsOptional() @IsBoolean() deliveryNotifications?: boolean;
  @IsOptional() @IsBoolean() emailNotifications?: boolean;
  @IsOptional() @IsIn(["system", "light", "dark"]) theme?: "system" | "light" | "dark";
  @IsOptional() @IsBoolean() compactMode?: boolean;
}

export class UpdateProfileDto {
  @IsOptional() @IsString() @MinLength(2) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
}

export class ChangePasswordDto {
  @IsString() @MinLength(4) currentPassword: string;
  @IsString() @MinLength(4) newPassword: string;
}
