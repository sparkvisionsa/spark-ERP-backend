import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { AuthModule } from "../auth/auth.module";
import { Employee, EmployeeSchema } from "../employees/schemas/employee.schema";
import { NotificationsController } from "./notifications.controller";
import { NotificationsService } from "./notifications.service";
import { Notification, NotificationSchema } from "./schemas/notification.schema";

@Module({
  imports: [
    AuthModule,
    MongooseModule.forFeature([
      { name: Notification.name, schema: NotificationSchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
