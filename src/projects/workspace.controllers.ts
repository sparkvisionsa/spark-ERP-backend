import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, Res, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { FilesInterceptor } from "@nestjs/platform-express";
import { Response } from "express";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { Role } from "../common/enums/role.enum";
import { RolesGuard } from "../common/guards/roles.guard";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { CreateDeliveryDto, CreateItemDto, CreateSubtaskDto, CreateTaskDto, UpdateItemDto, UpdateSubtaskDto, UpdateTaskDto } from "./dto/workspace.dto";
import { ProjectsService } from "./projects.service";
import { DeliveryUpload } from "./delivery-files.service";

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("workspace")
@Controller("workspace")
export class WorkspaceController {
  constructor(private readonly projects: ProjectsService) {}
  @Get("tree") tree(@Query("projectId") projectId: string, @CurrentUser() user: AuthUser) { return this.projects.workspace(projectId, user); }
}

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(private readonly projects: ProjectsService) {}
  @Post() @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) create(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthUser) { return this.projects.createTask(dto, user); }
  @Patch(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) update(@Param("id") id: string, @Body() dto: UpdateTaskDto, @CurrentUser() user: AuthUser) { return this.projects.updateTask(id, dto, user); }
  @Delete(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) remove(@Param("id") id: string, @Query("projectId") projectId: string, @CurrentUser() user: AuthUser) { return this.projects.deleteTask(id, projectId, user); }
}

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("subtasks")
@Controller("subtasks")
export class SubtasksController {
  constructor(private readonly projects: ProjectsService) {}
  @Post("task/:taskId") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) create(@Param("taskId") taskId: string, @Body() dto: CreateSubtaskDto, @CurrentUser() user: AuthUser) { return this.projects.createSubtask(taskId, dto, user); }
  @Patch(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) update(@Param("id") id: string, @Body() dto: UpdateSubtaskDto, @CurrentUser() user: AuthUser) { return this.projects.updateSubtask(id, dto, user); }
  @Delete(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) remove(@Param("id") id: string, @Query("projectId") projectId: string, @CurrentUser() user: AuthUser) { return this.projects.deleteSubtask(id, projectId, user); }
}

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("items")
@Controller("items")
export class ItemsController {
  constructor(private readonly projects: ProjectsService) {}
  @Post("subtask/:subtaskId") create(@Param("subtaskId") subtaskId: string, @Body() dto: CreateItemDto, @CurrentUser() user: AuthUser) { return this.projects.createItem(subtaskId, dto, user); }
  @Patch(":id") update(@Param("id") id: string, @Body() dto: UpdateItemDto, @CurrentUser() user: AuthUser) { return this.projects.updateItem(id, dto, user); }
  @Delete(":id") @Roles(Role.SUPER_ADMIN, Role.SUPERVISOR) remove(@Param("id") id: string, @Query("projectId") projectId: string, @CurrentUser() user: AuthUser) { return this.projects.deleteItem(id, projectId, user); }
}

@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags("deliveries")
@Controller("deliveries")
export class DeliveriesController {
  constructor(private readonly projects: ProjectsService) {}
  @Get() list(@Query("projectId") projectId: string, @Query("taskId") taskId: string | undefined, @Query("subtaskId") subtaskId: string | undefined, @Query("itemId") itemId: string | undefined, @CurrentUser() user: AuthUser) { return this.projects.listDeliveries(projectId, user, { taskId, subtaskId, itemId }); }
  @Get("files/:id") file(@Param("id") id: string, @Headers("range") range: string | undefined, @Query("download") download: string | undefined, @CurrentUser() user: AuthUser, @Res() response: Response) { return this.projects.sendDeliveryFile(id, user, response, range, download === "1"); }
  @Post()
  @UseInterceptors(FilesInterceptor("files", 6, { limits: { fileSize: 50 * 1024 * 1024, files: 6, fields: 20 } }))
  create(@Body() dto: CreateDeliveryDto, @UploadedFiles() files: DeliveryUpload[] = [], @CurrentUser() user: AuthUser) { return this.projects.createDelivery(dto, user, files); }
  @Delete(":id") remove(@Param("id") id: string, @Query("projectId") projectId: string, @CurrentUser() user: AuthUser) { return this.projects.deleteDelivery(id, projectId, user); }
}
