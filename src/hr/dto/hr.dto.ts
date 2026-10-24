import { IsDateString, IsEnum, IsOptional, IsString, IsUrl, MinLength } from "class-validator";
import { LeaveStatus } from "../schemas/hr-record.schema";

export class CreateLeaveDto {
  @IsString() @MinLength(2) type: string;
  @IsDateString() startDate: string;
  @IsDateString() endDate: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateLeaveStatusDto { @IsEnum(LeaveStatus) status: LeaveStatus; }

export class CreateAttendanceDto {
  @IsDateString() date: string;
  @IsOptional() @IsString() checkIn?: string;
  @IsOptional() @IsString() checkOut?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateEmployeeDocumentDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() type?: string;
  @IsOptional() @IsUrl({ require_protocol: true }) url?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
  @IsOptional() @IsString() notes?: string;
}
