import { ArrayUnique, IsArray, IsBoolean, IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, IsUrl } from "class-validator";
import { TaskPriority, WorkStatus } from "../schemas/project.schema";

export class CreateTaskDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsString() @IsNotEmpty({ message: "عنوان المهمة مطلوب" }) title: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty({ message: "الموظف المسؤول مطلوب" }) assigneeId: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) helperIds?: string[];
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString({}, { message: "موعد المهمة غير صحيح" }) dueDate?: string | null;
  @IsOptional() @IsArray() @IsString({ each: true }) subtaskTitles?: string[];
}

export class UpdateTaskDto {
  @IsString() @IsNotEmpty() projectId: string;
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() assigneeId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @IsString({ each: true }) helperIds?: string[];
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() dueDate?: string | null;
  @IsOptional() @IsEnum(WorkStatus) manualStatus?: WorkStatus;
}

export class ProjectReferenceDto { @IsString() @IsNotEmpty() projectId: string; }

export class CreateSubtaskDto extends ProjectReferenceDto {
  @IsString() @IsNotEmpty({ message: "عنوان المهمة الفرعية مطلوب" }) title: string;
  @IsOptional() @IsArray() @IsString({ each: true }) itemTexts?: string[];
}

export class UpdateSubtaskDto extends ProjectReferenceDto {
  @IsOptional() @IsString() @IsNotEmpty() title?: string;
  @IsOptional() @IsEnum(WorkStatus) manualStatus?: WorkStatus;
}

export class CreateItemDto extends ProjectReferenceDto {
  @IsString() @IsNotEmpty({ message: "نص بند التنفيذ مطلوب" }) text: string;
}

export class UpdateItemDto extends ProjectReferenceDto {
  @IsOptional() @IsString() @IsNotEmpty() text?: string;
  @IsOptional() @IsBoolean() done?: boolean;
}

export class ReorderNodeDto extends ProjectReferenceDto {
  @IsIn(["member", "task", "subtask", "item"]) entity: "member" | "task" | "subtask" | "item";
  @IsString() @IsNotEmpty() id: string;
  @IsOptional() @IsIn(["up", "down"]) direction?: "up" | "down";
  @IsOptional() @IsString() targetId?: string;
}

export class CreateDeliveryDto extends ProjectReferenceDto {
  @IsString() @IsNotEmpty() taskId: string;
  @IsOptional() @IsString() itemId?: string;
  @IsOptional() @IsString() text?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }, { message: "رابط التسليم يجب أن يبدأ بـ https://" }) link?: string;
  @IsOptional() @IsString() attachmentName?: string;
  @IsOptional() @IsIn(["image", "video", "file", "link"]) attachmentType?: "image" | "video" | "file" | "link";
}
