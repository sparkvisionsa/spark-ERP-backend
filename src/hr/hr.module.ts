import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";
import { HrRecord, HrRecordSchema } from "./schemas/hr-record.schema";
import { Project, ProjectSchema } from "../projects/schemas/project.schema";
import { Company, CompanySchema } from "../companies/schemas/company.schema";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({ imports: [AuthModule, NotificationsModule, MongooseModule.forFeature([{ name: HrRecord.name, schema: HrRecordSchema }, { name: Employee.name, schema: EmployeeSchema }, { name: Project.name, schema: ProjectSchema }, { name: Company.name, schema: CompanySchema }])], controllers: [HrController], providers: [HrService] })
export class HrModule {}
