import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { EmployeesController } from "./employees.controller";
import { EmployeesService } from "./employees.service";
import { Employee, EmployeeSchema } from "./schemas/employee.schema";
import { Company, CompanySchema } from "../companies/schemas/company.schema";

@Module({
  imports: [MongooseModule.forFeature([{ name: Employee.name, schema: EmployeeSchema }, { name: Company.name, schema: CompanySchema }])],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService, MongooseModule]
})
export class EmployeesModule {}
