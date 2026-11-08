import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export enum LeaveStatus { PENDING = "PENDING", APPROVED = "APPROVED", REJECTED = "REJECTED" }
export enum AttendanceStatus { WORKING = "WORKING", COMPLETED = "COMPLETED" }
export enum AttendanceCheckInStatus { EARLY = "EARLY", ON_TIME = "ON_TIME", LATE = "LATE", AFTER_HOURS = "AFTER_HOURS" }
export enum AttendanceCheckOutStatus { EARLY = "EARLY", ON_TIME = "ON_TIME", LATE = "LATE", OVERTIME = "OVERTIME" }

@Schema({ _id: false, versionKey: false })
export class AttendanceWorkReference {
  @Prop({ required: true }) projectId: string;
  @Prop({ default: "" }) projectName: string;
  @Prop({ required: true }) taskId: string;
  @Prop({ default: "" }) taskTitle: string;
  @Prop({ required: true }) subtaskId: string;
  @Prop({ default: "" }) subtaskTitle: string;
  @Prop({ default: false }) pausedAutomatically: boolean;
}
export const AttendanceWorkReferenceSchema = SchemaFactory.createForClass(AttendanceWorkReference);

@Schema({ _id: true, timestamps: true })
export class AttendanceBreakRecord {
  @Prop({ type: Date, required: true }) startedAt: Date;
  @Prop({ type: Date, default: null }) endedAt?: Date | null;
  @Prop({ default: 0, min: 0 }) durationSeconds: number;
  @Prop({ type: AttendanceWorkReferenceSchema, default: null }) pausedWork?: AttendanceWorkReference | null;
}
export const AttendanceBreakRecordSchema = SchemaFactory.createForClass(AttendanceBreakRecord);

@Schema({ _id: true, timestamps: true })
export class LeaveRecord {
  @Prop({ required: true }) type: string;
  @Prop({ required: true }) startDate: Date;
  @Prop({ required: true }) endDate: Date;
  @Prop({ default: "" }) notes: string;
  @Prop({ enum: LeaveStatus, default: LeaveStatus.PENDING }) status: LeaveStatus;
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee" }) reviewedById?: Types.ObjectId;
  createdAt?: Date;
}

@Schema({ _id: true, timestamps: true })
export class AttendanceRecord {
  @Prop({ required: true }) date: Date;
  @Prop({ default: "", index: true }) dateKey: string;
  @Prop({ default: "" }) checkIn: string;
  @Prop({ default: "" }) checkOut: string;
  @Prop({ default: "" }) notes: string;
  @Prop({ type: Date, default: null }) checkedInAt?: Date | null;
  @Prop({ type: Date, default: null }) checkoutAvailableAt?: Date | null;
  @Prop({ type: Date, default: null }) officialStartAt?: Date | null;
  @Prop({ type: Date, default: null }) officialEndAt?: Date | null;
  @Prop({ type: Date, default: null }) checkedOutAt?: Date | null;
  @Prop({ type: String, enum: AttendanceCheckInStatus, default: null }) checkInStatus?: AttendanceCheckInStatus | null;
  @Prop({ type: String, enum: AttendanceCheckOutStatus, default: null }) checkOutStatus?: AttendanceCheckOutStatus | null;
  @Prop({ type: String, enum: AttendanceStatus, default: null }) status?: AttendanceStatus | null;
  @Prop({ type: [AttendanceBreakRecordSchema], default: [] }) breaks: AttendanceBreakRecord[];
  @Prop({ type: AttendanceWorkReferenceSchema, default: null }) pausedWork?: AttendanceWorkReference | null;
  @Prop({ type: AttendanceWorkReferenceSchema, default: null }) resumedWork?: AttendanceWorkReference | null;
  createdAt?: Date;
}

@Schema({ _id: true, timestamps: true })
export class EmployeeDocumentRecord {
  @Prop({ required: true }) name: string;
  @Prop({ default: "عام" }) type: string;
  @Prop({ default: "" }) url: string;
  @Prop({ type: Date, default: null }) expiresAt?: Date | null;
  @Prop({ default: "" }) notes: string;
  createdAt?: Date;
}

@Schema({ timestamps: true, versionKey: false })
export class HrRecord {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", required: true, unique: true, index: true }) employeeId: Types.ObjectId;
  @Prop({ type: [LeaveRecord], default: [] }) leaves: LeaveRecord[];
  @Prop({ type: [AttendanceRecord], default: [] }) attendance: AttendanceRecord[];
  @Prop({ type: [EmployeeDocumentRecord], default: [] }) documents: EmployeeDocumentRecord[];
}

export type HrRecordDocument = HydratedDocument<HrRecord>;
export const HrRecordSchema = SchemaFactory.createForClass(HrRecord);
