import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument, Types } from "mongoose";

export type SystemSettingsDocument = HydratedDocument<SystemSettings>;
export type UserPreferencesDocument = HydratedDocument<UserPreferences>;

@Schema({ timestamps: true, versionKey: false })
export class SystemSettings {
  @Prop({ required: true, unique: true, default: "global" }) key: string;
  @Prop({ trim: true, default: "Spark ERP" }) systemName: string;
  @Prop({ default: "Asia/Riyadh" }) timezone: string;
  @Prop({ default: "ar-SA" }) locale: string;
  @Prop({ default: "DD/MM/YYYY" }) dateFormat: string;
  @Prop({ default: true }) showPercentages: boolean;
  @Prop({ default: true }) rememberLastProject: boolean;
  @Prop({ default: true }) confirmSensitiveActions: boolean;
  @Prop({ type: Types.ObjectId, ref: "Employee" }) updatedById?: Types.ObjectId;
}

@Schema({ timestamps: true, versionKey: false })
export class UserPreferences {
  @Prop({ type: Types.ObjectId, ref: "Employee", required: true, unique: true, index: true }) userId: Types.ObjectId;
  @Prop({ default: true }) notificationsEnabled: boolean;
  @Prop({ default: true }) taskNotifications: boolean;
  @Prop({ default: true }) deliveryNotifications: boolean;
  @Prop({ default: false }) emailNotifications: boolean;
  @Prop({ enum: ["system", "light", "dark"], default: "system" }) theme: "system" | "light" | "dark";
  @Prop({ default: true }) compactMode: boolean;
}

export const SystemSettingsSchema = SchemaFactory.createForClass(SystemSettings);
export const UserPreferencesSchema = SchemaFactory.createForClass(UserPreferences);
