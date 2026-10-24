import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";
import { CompanyKey, EmployeeStatus, Role } from "../../common/enums/role.enum";

export type EmployeeDocument = HydratedDocument<Employee>;

@Schema({ timestamps: true, versionKey: false, toJSON: { virtuals: true, transform: (_doc, ret: Record<string, any>) => { delete ret.passwordHash; delete ret.refreshTokenHash; return ret; } } })
export class Employee {
  @Prop({ trim: true, default: "موظف جديد" }) fullName: string;
  @Prop({ trim: true, unique: true, sparse: true }) nationalId?: string;
  @Prop({ trim: true, unique: true, sparse: true }) phone?: string;
  @Prop({ trim: true, lowercase: true, unique: true, sparse: true }) email?: string;
  @Prop({ required: true, select: false }) passwordHash: string;
  @Prop({ select: false }) refreshTokenHash?: string;
  @Prop({ required: true, enum: Role, index: true }) role: Role;
  @Prop({ type: String, enum: CompanyKey, index: true, default: null }) company: CompanyKey | null;
  @Prop({ trim: true, default: "" }) department: string;
  @Prop({ trim: true, default: "" }) jobTitle: string;
  @Prop({ type: String, default: null }) directManagerId?: string | null;
  @Prop({ type: Date, default: null }) birthDate?: Date | null;
  @Prop({ type: Date, default: null }) hireDate?: Date | null;
  @Prop({ trim: true, default: "ذكر" }) gender: string;
  @Prop({ trim: true, default: "دوام كامل" }) contractType: string;
  @Prop({ required: true, enum: EmployeeStatus, default: EmployeeStatus.ACTIVE, index: true }) status: EmployeeStatus;
  @Prop({ type: Date, default: null }) lastLoginAt?: Date | null;
  @Prop({ type: Date, default: null, index: true }) deletedAt?: Date | null;
}

export const EmployeeSchema = SchemaFactory.createForClass(Employee);
EmployeeSchema.index({ fullName: "text", phone: "text", email: "text" });
