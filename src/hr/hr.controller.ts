import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { CreateAttendanceDto, CreateEmployeeDocumentDto, CreateLeaveDto, UpdateLeaveStatusDto } from "./dto/hr.dto";
import { HrService } from "./hr.service";

@ApiTags("hr")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("hr")
export class HrController {
  constructor(private readonly service: HrService) {}

  @Get("employees/:employeeId")
  get(@Param("employeeId") employeeId: string, @CurrentUser() user: AuthUser) { return this.service.get(employeeId, user); }

  @Get("attendance/me") @Roles(Role.SUPERVISOR, Role.EMPLOYEE)
  attendanceStatus(@CurrentUser() user: AuthUser) { return this.service.attendanceStatus(user); }

  @Get("attendance/overview") @Roles(Role.SUPER_ADMIN)
  attendanceOverview() { return this.service.attendanceOverview(); }

  @Post("attendance/check-in") @Roles(Role.SUPERVISOR, Role.EMPLOYEE)
  checkIn(@CurrentUser() user: AuthUser) { return this.service.checkIn(user); }

  @Post("attendance/check-out") @Roles(Role.SUPERVISOR, Role.EMPLOYEE)
  checkOut(@CurrentUser() user: AuthUser) { return this.service.checkOut(user); }

  @Post("attendance/break/start") @Roles(Role.SUPERVISOR, Role.EMPLOYEE)
  startBreak(@CurrentUser() user: AuthUser) { return this.service.startBreak(user); }

  @Post("attendance/break/end") @Roles(Role.SUPERVISOR, Role.EMPLOYEE)
  endBreak(@CurrentUser() user: AuthUser) { return this.service.endBreak(user); }

  @Post("employees/:employeeId/leaves") @Roles(Role.SUPER_ADMIN)
  addLeave(@Param("employeeId") employeeId: string, @Body() dto: CreateLeaveDto) { return this.service.addLeave(employeeId, dto); }

  @Patch("employees/:employeeId/leaves/:recordId") @Roles(Role.SUPER_ADMIN)
  updateLeave(@Param("employeeId") employeeId: string, @Param("recordId") recordId: string, @Body() dto: UpdateLeaveStatusDto, @CurrentUser() user: AuthUser) { return this.service.updateLeave(employeeId, recordId, dto, user); }

  @Post("employees/:employeeId/attendance") @Roles(Role.SUPER_ADMIN)
  addAttendance(@Param("employeeId") employeeId: string, @Body() dto: CreateAttendanceDto) { return this.service.addAttendance(employeeId, dto); }

  @Post("employees/:employeeId/documents") @Roles(Role.SUPER_ADMIN)
  addDocument(@Param("employeeId") employeeId: string, @Body() dto: CreateEmployeeDocumentDto) { return this.service.addDocument(employeeId, dto); }

  @Delete("employees/:employeeId/:collection/:recordId") @Roles(Role.SUPER_ADMIN)
  remove(@Param("employeeId") employeeId: string, @Param("collection") collection: "leaves" | "attendance" | "documents", @Param("recordId") recordId: string) { return this.service.remove(employeeId, collection, recordId); }
}
