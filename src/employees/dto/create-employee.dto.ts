import { IsEmail, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MinLength, ValidateIf } from "class-validator";
import { CompanyKey, Role } from "../../common/enums/role.enum";

export class CreateEmployeeDto {
  @IsOptional() @IsString({ message: "الاسم يجب أن يكون نصاً" }) fullName?: string;
  @ValidateIf((value) => !value.phone && !value.email) @IsString() @Matches(/^\d{10}$/, { message: "رقم الهوية يجب أن يتكون من 10 أرقام" }) nationalId?: string;
  @ValidateIf((value) => !value.nationalId && !value.email) @IsString() @Matches(/^(?:\+?966|0)?5\d{8}$/, { message: "رقم الجوال السعودي غير صحيح" }) phone?: string;
  @ValidateIf((value) => !value.nationalId && !value.phone) @IsEmail({}, { message: "البريد الإلكتروني غير صحيح" }) email?: string;
  @IsString() @MinLength(4, { message: "الرقم السري يجب ألا يقل عن 4 أحرف" }) password: string;
  @IsIn([Role.SUPERVISOR, Role.EMPLOYEE], { message: "نوع الحساب يجب أن يكون مشرفاً أو موظفاً" }) role: Role.SUPERVISOR | Role.EMPLOYEE;
  @IsString({ message: "الشركة غير صحيحة" }) @IsNotEmpty() company: CompanyKey;
  @IsOptional() @IsString() department?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() directManagerId?: string;
  @IsOptional() @IsString() birthDate?: string;
  @IsOptional() @IsString() hireDate?: string;
  @IsOptional() @IsString() gender?: string;
  @IsOptional() @IsString() contractType?: string;
}
