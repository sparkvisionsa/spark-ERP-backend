import { PartialType } from "@nestjs/swagger";
import { ArrayUnique, IsArray, IsDateString, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";
import { CompanyKey } from "../../common/enums/role.enum";
import { ProjectStatus } from "../schemas/project.schema";

export class CreateProjectDto {
  @IsString() @IsNotEmpty({ message: "اسم المشروع مطلوب" }) name: string;
  @IsEnum(CompanyKey, { message: "الشركة غير صحيحة" }) company: CompanyKey;
  @IsOptional() @IsString() client?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsDateString({}, { message: "تاريخ البداية غير صحيح" }) startDate?: string;
  @IsDateString({}, { message: "تاريخ التسليم غير صحيح" }) dueDate: string;
  @IsOptional() @IsNumber() @Min(0) budget?: number;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) memberIds?: string[];
}

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
}

export class AssignProjectMembersDto {
  @IsArray() @ArrayUnique() @IsString({ each: true }) memberIds: string[];
}
