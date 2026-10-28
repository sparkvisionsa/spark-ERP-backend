import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, Matches } from "class-validator";

export class CreateCompanyDto {
  @IsString() name: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/, { message: "رمز الشركة يجب أن يحتوي أحرفًا إنجليزية صغيرة أو أرقامًا أو شرطات" }) key?: string;
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) logoUrl?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) departments?: string[];
}

export class AddDepartmentDto { @IsString() name: string; }
export class UpdateDepartmentDto { @IsString() name: string; }
export class UpdateCompanyDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsUrl({ protocols: ["http", "https"], require_protocol: true }) logoUrl?: string;
  @IsOptional() @IsString() color?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}
