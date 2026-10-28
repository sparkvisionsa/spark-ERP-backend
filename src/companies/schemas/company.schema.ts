import { Prop, Schema, SchemaFactory } from "@nestjs/mongoose";
import { HydratedDocument } from "mongoose";

export type CompanyDocument = HydratedDocument<Company>;

@Schema({ _id: false, versionKey: false })
export class CompanyDepartment {
  @Prop({ required: true, trim: true }) name: string;
}
export const CompanyDepartmentSchema = SchemaFactory.createForClass(CompanyDepartment);

@Schema({ timestamps: true, versionKey: false })
export class Company {
  @Prop({ required: true, trim: true }) name: string;
  @Prop({ required: true, trim: true, lowercase: true, unique: true, index: true }) key: string;
  @Prop({ trim: true, default: "" }) logoUrl: string;
  @Prop({ trim: true, default: "#7A2838" }) color: string;
  @Prop({ type: [CompanyDepartmentSchema], default: [] }) departments: CompanyDepartment[];
  @Prop({ default: true, index: true }) active: boolean;
}
export const CompanySchema = SchemaFactory.createForClass(Company);
