import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { CompaniesController } from "./companies.controller";
import { CompaniesService } from "./companies.service";
import { Company, CompanySchema } from "./schemas/company.schema";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { Project, ProjectSchema } from "../projects/schemas/project.schema";

@Module({ imports: [MongooseModule.forFeature([{ name: Company.name, schema: CompanySchema }, { name: Employee.name, schema: EmployeeSchema }, { name: Project.name, schema: ProjectSchema }])], controllers: [CompaniesController], providers: [CompaniesService], exports: [MongooseModule, CompaniesService] })
export class CompaniesModule {}
