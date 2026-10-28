import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { RolesGuard } from "../common/guards/roles.guard";
import { AssignProjectMembersDto, CreateProjectDto, MoveProjectDto, UpdateProjectDto } from "./dto/project.dto";
import { ProjectsService } from "./projects.service";

@ApiTags("projects")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}
  @Get() list(@CurrentUser() user: AuthUser, @Query("company") company?: string, @Query("archived") archived?: string) { return this.projectsService.list(user, company, archived === "true"); }
  @Get(":id") get(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.projectsService.get(id, user); }
  @Post() @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) create(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthUser) { return this.projectsService.create(dto, user); }
  @Patch(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) update(@Param("id") id: string, @Body() dto: UpdateProjectDto, @CurrentUser() user: AuthUser) { return this.projectsService.update(id, dto, user); }
  @Patch(":id/move") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) move(@Param("id") id: string, @Body() dto: MoveProjectDto, @CurrentUser() user: AuthUser) { return this.projectsService.moveProject(id, dto.direction, dto.targetId, user); }
  @Patch(":id/members") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) assign(@Param("id") id: string, @Body() dto: AssignProjectMembersDto, @CurrentUser() user: AuthUser) { return this.projectsService.assignMembers(id, dto, user); }
  @Delete(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) remove(@Param("id") id: string, @CurrentUser() user: AuthUser) { return this.projectsService.remove(id, user); }
}
