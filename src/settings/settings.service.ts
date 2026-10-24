import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { Model, Types } from "mongoose";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { EmployeesService } from "../employees/employees.service";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { ChangePasswordDto, UpdatePreferencesDto, UpdateProfileDto, UpdateSystemSettingsDto } from "./dto/settings.dto";
import { SystemSettings, SystemSettingsDocument, UserPreferences, UserPreferencesDocument } from "./schemas/settings.schema";

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(SystemSettings.name) private readonly systemModel: Model<SystemSettingsDocument>,
    @InjectModel(UserPreferences.name) private readonly preferencesModel: Model<UserPreferencesDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>
  ) {}

  private systemDefaults() {
    return { key: "global", systemName: "Spark ERP", timezone: "Asia/Riyadh", locale: "ar-SA", dateFormat: "DD/MM/YYYY", showPercentages: true, rememberLastProject: true, confirmSensitiveActions: true };
  }

  private preferenceDefaults(userId: string) {
    return { userId: new Types.ObjectId(userId), notificationsEnabled: true, taskNotifications: true, deliveryNotifications: true, emailNotifications: false, theme: "system", compactMode: true };
  }

  async get(user: AuthUser) {
    const [system, preferences, profile] = await Promise.all([
      this.systemModel.findOne({ key: "global" }).lean(),
      this.preferencesModel.findOne({ userId: user.id }).lean(),
      this.employeeModel.findOne({ _id: user.id, deletedAt: null }).select("fullName phone email role company department jobTitle status lastLoginAt").lean()
    ]);
    if (!profile) throw new NotFoundException("الحساب غير موجود");
    return { system: system || this.systemDefaults(), preferences: preferences || this.preferenceDefaults(user.id), profile };
  }

  async updateSystem(user: AuthUser, dto: UpdateSystemSettingsDto) {
    return this.systemModel.findOneAndUpdate({ key: "global" }, { $set: { ...dto, updatedById: user.id }, $setOnInsert: { key: "global" } }, { new: true, upsert: true, runValidators: true }).lean();
  }

  async updatePreferences(user: AuthUser, dto: UpdatePreferencesDto) {
    return this.preferencesModel.findOneAndUpdate({ userId: user.id }, { $set: dto, $setOnInsert: { userId: user.id } }, { new: true, upsert: true, runValidators: true }).lean();
  }

  async updateProfile(user: AuthUser, dto: UpdateProfileDto) {
    const update: Record<string, string> = {};
    if (dto.fullName !== undefined) update.fullName = dto.fullName.trim();
    if (dto.email !== undefined) update.email = dto.email.toLowerCase().trim();
    if (dto.phone !== undefined) {
      const normalized = EmployeesService.normalizePhone(dto.phone);
      if (!normalized) throw new BadRequestException("رقم الجوال غير صالح");
      update.phone = normalized;
    }
    try {
      const profile = await this.employeeModel.findOneAndUpdate({ _id: user.id, deletedAt: null }, update, { new: true, runValidators: true }).select("fullName phone email role company department jobTitle status lastLoginAt").lean();
      if (!profile) throw new NotFoundException("الحساب غير موجود");
      return profile;
    } catch (error: any) {
      if (error?.code === 11000) throw new ConflictException("رقم الجوال أو البريد مستخدم في حساب آخر");
      throw error;
    }
  }

  async changePassword(user: AuthUser, dto: ChangePasswordDto) {
    if (dto.currentPassword === dto.newPassword) throw new BadRequestException("يجب أن تختلف كلمة المرور الجديدة عن الحالية");
    const employee = await this.employeeModel.findOne({ _id: user.id, deletedAt: null }).select("+passwordHash +refreshTokenHash");
    if (!employee || !(await bcrypt.compare(dto.currentPassword, employee.passwordHash))) throw new UnauthorizedException("كلمة المرور الحالية غير صحيحة");
    employee.passwordHash = await bcrypt.hash(dto.newPassword, 12);
    employee.refreshTokenHash = undefined;
    await employee.save();
    return { message: "تم تغيير كلمة المرور بنجاح" };
  }
}
