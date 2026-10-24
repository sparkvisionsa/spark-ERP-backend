import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { HrController } from "./hr.controller";
import { HrService } from "./hr.service";
import { HrRecord, HrRecordSchema } from "./schemas/hr-record.schema";

@Module({ imports: [AuthModule, MongooseModule.forFeature([{ name: HrRecord.name, schema: HrRecordSchema }, { name: Employee.name, schema: EmployeeSchema }])], controllers: [HrController], providers: [HrService] })
export class HrModule {}
