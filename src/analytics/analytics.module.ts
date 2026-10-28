import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { Project, ProjectSchema } from "../projects/schemas/project.schema";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { Company, CompanySchema } from "../companies/schemas/company.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: Employee.name, schema: EmployeeSchema },
      { name: Company.name, schema: CompanySchema }
    ])
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService]
})
export class AnalyticsModule {}
