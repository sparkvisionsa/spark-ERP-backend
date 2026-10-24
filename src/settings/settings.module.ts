import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { SystemSettings, SystemSettingsSchema, UserPreferences, UserPreferencesSchema } from "./schemas/settings.schema";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";

@Module({
  imports: [AuthModule, MongooseModule.forFeature([
    { name: SystemSettings.name, schema: SystemSettingsSchema },
    { name: UserPreferences.name, schema: UserPreferencesSchema },
    { name: Employee.name, schema: EmployeeSchema }
  ])],
  controllers: [SettingsController],
  providers: [SettingsService]
})
export class SettingsModule {}
