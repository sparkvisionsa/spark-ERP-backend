import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";
import { CompanyKey } from "../../common/enums/role.enum";

export type ProjectDocument = HydratedDocument<Project>;
export enum ProjectStatus { ACTIVE = "ACTIVE", COMPLETED = "COMPLETED", ARCHIVED = "ARCHIVED" }
export enum WorkStatus { NOT_STARTED = "NOT_STARTED", IN_PROGRESS = "IN_PROGRESS", COMPLETED = "COMPLETED" }
export enum TaskPriority { NORMAL = "NORMAL", IMPORTANT = "IMPORTANT", URGENT = "URGENT" }

@Schema({ _id: true, versionKey: false })
export class ChecklistItem {
  @Prop({ required: true, trim: true }) text: string;
  @Prop({ default: false }) done: boolean;
  @Prop({ default: 0, min: 0 }) attachments: number;
  @Prop({ default: 0 }) order: number;
}
export const ChecklistItemSchema = SchemaFactory.createForClass(ChecklistItem);

@Schema({ _id: true, versionKey: false })
export class ProjectSubtask {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ enum: WorkStatus, default: WorkStatus.NOT_STARTED }) manualStatus: WorkStatus;
  @Prop({ default: 0 }) order: number;
  @Prop({ type: [ChecklistItemSchema], default: [] }) items: ChecklistItem[];
}
export const ProjectSubtaskSchema = SchemaFactory.createForClass(ProjectSubtask);

@Schema({ _id: true, versionKey: false, timestamps: true })
export class ProjectTask {
  @Prop({ required: true, trim: true }) title: string;
  @Prop({ trim: true, default: "" }) description: string;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", required: true }) assigneeId: Types.ObjectId;
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: "Employee" }], default: [] }) helperIds: Types.ObjectId[];
  @Prop({ enum: TaskPriority, default: TaskPriority.NORMAL }) priority: TaskPriority;
  @Prop({ type: Date, required: true }) dueDate: Date;
  @Prop({ enum: WorkStatus, default: WorkStatus.NOT_STARTED }) manualStatus: WorkStatus;
  @Prop({ default: 0 }) order: number;
  @Prop({ type: [ProjectSubtaskSchema], default: [] }) subtasks: ProjectSubtask[];
  createdAt?: Date;
  updatedAt?: Date;
}
export const ProjectTaskSchema = SchemaFactory.createForClass(ProjectTask);

@Schema({ _id: false, versionKey: false })
export class ProjectDeliveryAttachment {
  @Prop({ required: true }) storageId: string;
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, trim: true }) mimeType: string;
  @Prop({ required: true, min: 0 }) size: number;
  @Prop({ enum: ["image", "video", "audio", "document", "archive", "file"], required: true }) kind: string;
  @Prop({ required: true, trim: true }) url: string;
}
export const ProjectDeliveryAttachmentSchema = SchemaFactory.createForClass(ProjectDeliveryAttachment);

@Schema({ _id: true, versionKey: false, timestamps: { createdAt: true, updatedAt: false } })
export class ProjectDelivery {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", required: true }) authorId: Types.ObjectId;
  @Prop({ required: true }) taskId: string;
  @Prop({ type: String, default: null }) subtaskId?: string | null;
  @Prop({ type: String, default: null }) itemId?: string | null;
  @Prop({ trim: true, default: "" }) text: string;
  @Prop({ trim: true, default: "" }) link: string;
  @Prop({ trim: true, default: "" }) attachmentName: string;
  @Prop({ enum: ["image", "video", "file", "link", ""], default: "" }) attachmentType: string;
  @Prop({ type: [ProjectDeliveryAttachmentSchema], default: [] }) attachments: ProjectDeliveryAttachment[];
  createdAt?: Date;
}
export const ProjectDeliverySchema = SchemaFactory.createForClass(ProjectDelivery);

@Schema({ timestamps: true, versionKey: false })
export class Project {
  @Prop({ required: true, trim: true, index: true }) name: string;
  @Prop({ required: true, enum: CompanyKey, index: true }) company: CompanyKey;
  @Prop({ trim: true, default: "" }) client: string;
  @Prop({ trim: true, default: "" }) description: string;
  @Prop({ type: Date, default: null }) startDate?: Date | null;
  @Prop({ type: Date, required: true, index: true }) dueDate: Date;
  @Prop({ type: Number, default: null, min: 0 }) budget?: number | null;
  @Prop({ enum: ProjectStatus, default: ProjectStatus.ACTIVE, index: true }) status: ProjectStatus;
  @Prop({ type: [{ type: MongooseSchema.Types.ObjectId, ref: "Employee" }], default: [] }) members: Types.ObjectId[];
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", required: true }) createdById: Types.ObjectId;
  @Prop({ type: [ProjectTaskSchema], default: [] }) tasks: ProjectTask[];
  @Prop({ type: [ProjectDeliverySchema], default: [] }) deliveries: ProjectDelivery[];
  @Prop({ type: Date, default: null }) archivedAt?: Date | null;
  @Prop({ type: Date, default: null, index: true }) deletedAt?: Date | null;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ company: 1, status: 1, deletedAt: 1 });
