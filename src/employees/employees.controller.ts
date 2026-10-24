import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { CompanyKey, EmployeeStatus, Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../common/guards/roles.guard";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { ChangeEmployeeStatusDto, ResetPasswordDto, UpdateEmployeeDto } from "./dto/update-employee.dto";
import { EmployeesService } from "./employees.service";

@ApiTags("employees")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("employees")
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query("company") company?: CompanyKey, @Query("status") status?: EmployeeStatus, @Query("q") q?: string) {
    return this.employeesService.list(user, { company, status, q });
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.employeesService.getById(id, user); }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateEmployeeDto) { return this.employeesService.create(dto); }

  @Patch(":id")
  @Roles(Role.SUPER_ADMIN)
  update(@Param("id") id: string, @Body() dto: UpdateEmployeeDto) { return this.employeesService.update(id, dto); }

  @Patch(":id/status")
  @Roles(Role.SUPER_ADMIN)
  changeStatus(@Param("id") id: string, @Body() dto: ChangeEmployeeStatusDto) { return this.employeesService.changeStatus(id, dto); }

  @Post(":id/reset-password")
  @Roles(Role.SUPER_ADMIN)
  resetPassword(@Param("id") id: string, @Body() dto: ResetPasswordDto) { return this.employeesService.resetPassword(id, dto); }

  @Delete(":id")
  @Roles(Role.SUPER_ADMIN)
  remove(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.employeesService.remove(id, user); }
}
