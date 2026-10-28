import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { Role } from "../common/enums/role.enum";
import { CompaniesService } from "./companies.service";
import { AddDepartmentDto, CreateCompanyDto, UpdateCompanyDto, UpdateDepartmentDto } from "./dto/company.dto";

@ApiTags("companies") @ApiCookieAuth("spark_access") @UseGuards(JwtAuthGuard, RolesGuard) @Controller("companies")
export class CompaniesController {
  constructor(private readonly companies: CompaniesService) {}
  @Get() list() { return this.companies.list(); }
  @Post() @Roles(Role.SUPER_ADMIN) create(@Body() dto: CreateCompanyDto) { return this.companies.create(dto); }
  @Patch(":key") @Roles(Role.SUPER_ADMIN) update(@Param("key") key: string, @Body() dto: UpdateCompanyDto) { return this.companies.update(key, dto); }
  @Delete(":key") @Roles(Role.SUPER_ADMIN) remove(@Param("key") key: string) { return this.companies.remove(key); }
  @Post(":key/departments") @Roles(Role.SUPER_ADMIN) addDepartment(@Param("key") key: string, @Body() dto: AddDepartmentDto) { return this.companies.addDepartment(key, dto); }
  @Patch(":key/departments/:department") @Roles(Role.SUPER_ADMIN) updateDepartment(@Param("key") key: string, @Param("department") department: string, @Body() dto: UpdateDepartmentDto) { return this.companies.updateDepartment(key, department, dto); }
  @Delete(":key/departments/:department") @Roles(Role.SUPER_ADMIN) removeDepartment(@Param("key") key: string, @Param("department") department: string) { return this.companies.removeDepartment(key, department); }
}
