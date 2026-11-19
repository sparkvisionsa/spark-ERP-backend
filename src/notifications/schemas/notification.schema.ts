import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Schema as MongooseSchema, Types } from "mongoose";

export type NotificationDocument = HydratedDocument<Notification>;

export enum NotificationType {
  TASK_ASSIGNED = "TASK_ASSIGNED",
  DELIVERY_CREATED = "DELIVERY_CREATED",
  CHECKLIST_ITEM_ADDED = "CHECKLIST_ITEM_ADDED",
  DELIVERY_REPLY = "DELIVERY_REPLY",
  ATTENDANCE_CHECK_IN = "ATTENDANCE_CHECK_IN",
  ATTENDANCE_CHECK_OUT = "ATTENDANCE_CHECK_OUT",
}

@Schema({ timestamps: true, versionKey: false })
export class Notification {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", required: true, index: true })
  recipientId: Types.ObjectId;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: "Employee", default: null })
  actorId?: Types.ObjectId | null;

  @Prop({ type: String, enum: NotificationType, required: true, index: true })
  type: NotificationType;

  @Prop({ required: true, trim: true }) title: string;
  @Prop({ required: true, trim: true }) message: string;
  @Prop({ trim: true, default: "" }) href: string;
  @Prop({ trim: true, default: "" }) projectId: string;
  @Prop({ trim: true, default: "" }) taskId: string;
  @Prop({ trim: true, default: "" }) subtaskId: string;
  @Prop({ required: true, trim: true }) eventKey: string;
  @Prop({ type: Date, default: null, index: true }) readAt?: Date | null;
  /** Set when the recipient dismisses the important-alert popup; the item can stay unread in the bell. */
  @Prop({ type: Date, default: null }) acknowledgedAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
NotificationSchema.index({ recipientId: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ recipientId: 1, eventKey: 1 }, { unique: true });
