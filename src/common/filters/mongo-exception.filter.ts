import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Response } from "express";

@Catch()
export class MongoExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    if (exception?.code !== 11000) throw exception;
    const response = host.switchToHttp().getResponse<Response>();
    const field = Object.keys(exception.keyPattern || {})[0] || "البيانات";
    response.status(HttpStatus.CONFLICT).json({ statusCode: 409, message: `${field === "phone" ? "رقم الجوال" : field === "email" ? "البريد الإلكتروني" : field === "nationalId" ? "رقم الهوية" : "البيانات"} مستخدم مسبقاً`, error: "Conflict" });
  }
}
