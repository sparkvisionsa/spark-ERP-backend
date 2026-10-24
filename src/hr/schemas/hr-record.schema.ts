import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export enum LeaveStatus { PENDING = "PENDING", APPROVED = "APPROVED", REJECTED = "REJECTED" }

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
  @Prop({ default: "" }) checkIn: string;
  @Prop({ default: "" }) checkOut: string;
  @Prop({ default: "" }) notes: string;
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
