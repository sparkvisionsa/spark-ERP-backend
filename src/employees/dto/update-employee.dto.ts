import { PartialType, PickType } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString, MinLength } from "class-validator";
import { EmployeeStatus } from "../../common/enums/role.enum";
import { CreateEmployeeDto } from "./create-employee.dto";

export class UpdateEmployeeDto extends PartialType(PickType(CreateEmployeeDto, ["fullName", "nationalId", "phone", "email", "role", "company", "department", "jobTitle", "directManagerId", "birthDate", "hireDate", "gender", "contractType"] as const)) {}

export class ChangeEmployeeStatusDto {
  @IsEnum(EmployeeStatus, { message: "حالة الموظف غير صحيحة" }) status: EmployeeStatus;
}

export class ResetPasswordDto {
  @IsString() @MinLength(4, { message: "الرقم السري يجب ألا يقل عن 4 أحرف" }) password: string;
}
