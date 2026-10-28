import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";
import { Project, ProjectSchema } from "./schemas/project.schema";
import { DeliveriesController, ItemsController, SubtasksController, TasksController, WorkspaceController } from "./workspace.controllers";
import { DeliveryFilesService } from "./delivery-files.service";
import { Company, CompanySchema } from "../companies/schemas/company.schema";

@Module({
  imports: [AuthModule, MongooseModule.forFeature([{ name: Project.name, schema: ProjectSchema }, { name: Employee.name, schema: EmployeeSchema }, { name: Company.name, schema: CompanySchema }])],
  controllers: [ProjectsController, WorkspaceController, TasksController, SubtasksController, ItemsController, DeliveriesController],
  providers: [ProjectsService, DeliveryFilesService]
})
export class ProjectsModule {}
