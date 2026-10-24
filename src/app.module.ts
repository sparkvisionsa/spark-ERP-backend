import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AuthModule } from "./auth/auth.module";
import { EmployeesModule } from "./employees/employees.module";
import { ProjectsModule } from "./projects/projects.module";
import { AnalyticsModule } from "./analytics/analytics.module";
import { SettingsModule } from "./settings/settings.module";
import { HrModule } from "./hr/hr.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    MongooseModule.forRootAsync({ inject: [ConfigService], useFactory: (config: ConfigService) => ({ uri: config.getOrThrow<string>("MONGO_URL_SCRAPPING"), dbName: config.get<string>("MONGO_DBNAME_SCRAPPING", "spark_erp"), autoIndex: true }) }),
    AuthModule,
    EmployeesModule,
    ProjectsModule,
    AnalyticsModule,
    SettingsModule,
    HrModule
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard }
  ]
})
export class AppModule {}
