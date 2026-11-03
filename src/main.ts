import { BadRequestException, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser = require("cookie-parser");
import helmet from "helmet";
import type { NextFunction, Request, Response } from "express";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  app.setGlobalPrefix("api");
  app.use(helmet());
  app.use(cookieParser());
  const allowedFrontend = config.get("FRONTEND_URL", "http://localhost:3000");
  app.use((request: Request, response: Response, next: NextFunction) => {
    const origin = request.get("origin");
    const readOnly = ["GET", "HEAD", "OPTIONS"].includes(request.method);
    if (origin && !readOnly && origin !== allowedFrontend) {
      return response.status(403).json({ message: "Request origin is not allowed" });
    }
    next();
  });
  app.enableCors({ origin: allowedFrontend, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, exceptionFactory: (errors) => new BadRequestException(errors.flatMap((error) => Object.values(error.constraints || {}))) }));
  const swaggerConfig = new DocumentBuilder().setTitle("Spark ERP API").setDescription("واجهة Spark ERP للمصادقة والموظفين والمشاريع").setVersion("1.0").addCookieAuth("spark_access").build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, swaggerConfig));
  await app.listen(config.get<number>("PORT", 4000));
}

void bootstrap();
