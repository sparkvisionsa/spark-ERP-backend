import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { FilterQuery, Model, Types } from "mongoose";
import { CompanyKey, EmployeeStatus, Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { CreateEmployeeDto } from "./dto/create-employee.dto";
import { ChangeEmployeeStatusDto, ResetPasswordDto, UpdateEmployeeDto } from "./dto/update-employee.dto";
import { Employee, EmployeeDocument } from "./schemas/employee.schema";
import { Company, CompanyDocument } from "../companies/schemas/company.schema";

@Injectable()
export class EmployeesService {
  constructor(@InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>, @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>) {}

  private async validateOrganisation(company: CompanyKey, department?: string) {
    const organisation = await this.companyModel.findOne({ key: company, active: true }).lean();
    if (!organisation) throw new BadRequestException("الشركة غير موجودة أو غير نشطة");
    if (department?.trim() && !(organisation.departments || []).some((entry) => entry.name === department.trim())) throw new BadRequestException("القسم لا يتبع الشركة المختارة");
  }

  static normalizePhone(value?: string) {
    if (!value) return undefined;
    const digits = value.replace(/\D/g, "");
    if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
    if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
    if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
    return value;
  }

  private scope(user: AuthUser): FilterQuery<EmployeeDocument> {
    const filter: FilterQuery<EmployeeDocument> = { deletedAt: null };
    if (user.role !== Role.SUPER_ADMIN) filter.company = user.company;
    return filter;
  }

  private throwDuplicate(error: any): never {
    if (error?.code !== 11000) throw error;
    const field = Object.keys(error.keyPattern || {})[0];
    const label = field === "phone" ? "رقم الجوال" : field === "email" ? "البريد الإلكتروني" : field === "nationalId" ? "رقم الهوية" : "بيانات الدخول";
    throw new ConflictException(`${label} مستخدم مسبقاً`);
  }

  async list(user: AuthUser, query?: { company?: CompanyKey; status?: EmployeeStatus; q?: string }) {
    const filter = this.scope(user);
    if (query?.company && user.role === Role.SUPER_ADMIN) filter.company = query.company;
    if (query?.status) filter.status = query.status;
    if (query?.q?.trim()) {
      const escaped = query.q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = [{ fullName: new RegExp(escaped, "i") }, { phone: new RegExp(escaped, "i") }, { email: new RegExp(escaped, "i") }];
    }
    return this.employeeModel.find(filter).sort({ createdAt: -1 }).lean();
  }

  async getById(id: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("الموظف غير موجود");
    const employee = await this.employeeModel.findOne({ _id: id, ...this.scope(user) }).lean();
    if (!employee) throw new NotFoundException("الموظف غير موجود");
    return employee;
  }

  async create(dto: CreateEmployeeDto) {
    if (!dto.phone && !dto.email && !dto.nationalId) throw new BadRequestException("يلزم إدخال رقم الهوية أو الجوال أو البريد الإلكتروني");
    await this.validateOrganisation(dto.company, dto.department);
    const passwordHash = await bcrypt.hash(dto.password, 12);
    try {
      return await this.employeeModel.create({ ...dto, fullName: dto.fullName?.trim() || "موظف جديد", phone: EmployeesService.normalizePhone(dto.phone), email: dto.email?.toLowerCase().trim(), passwordHash, birthDate: dto.birthDate ? new Date(dto.birthDate) : null, hireDate: dto.hireDate ? new Date(dto.hireDate) : null });
    } catch (error) { this.throwDuplicate(error); }
  }

  async update(id: string, dto: UpdateEmployeeDto) {
    const current = await this.employeeModel.findOne({ _id: id, deletedAt: null }).lean();
    if (!current) throw new NotFoundException("الموظف غير موجود أو لا يمكن تعديله");
    const company = dto.company || current.company;
    const companyChanged = Boolean(dto.company && dto.company !== current.company);
    const department = dto.department === undefined ? (companyChanged ? "" : current.department) : dto.department;
    if (company) await this.validateOrganisation(company, department);
    const update: Record<string, unknown> = { ...dto };
    if (companyChanged && dto.department === undefined) update.department = "";
    if (dto.phone) update.phone = EmployeesService.normalizePhone(dto.phone);
    if (dto.email) update.email = dto.email.toLowerCase().trim();
    if (dto.birthDate) update.birthDate = new Date(dto.birthDate);
    if (dto.hireDate) update.hireDate = new Date(dto.hireDate);
    let employee;
    try { employee = await this.employeeModel.findOneAndUpdate({ _id: id, deletedAt: null, role: { $ne: Role.SUPER_ADMIN } }, update, { new: true, runValidators: true }); }
    catch (error) { this.throwDuplicate(error); }
    if (!employee) throw new NotFoundException("الموظف غير موجود أو لا يمكن تعديله");
    return employee;
  }

  async changeStatus(id: string, dto: ChangeEmployeeStatusDto) {
    const employee = await this.employeeModel.findOneAndUpdate({ _id: id, deletedAt: null, role: { $ne: Role.SUPER_ADMIN } }, { status: dto.status }, { new: true });
    if (!employee) throw new NotFoundException("الموظف غير موجود أو لا يمكن تعديل حالته");
    return employee;
  }

  async resetPassword(id: string, dto: ResetPasswordDto) {
    const passwordHash = await bcrypt.hash(dto.password, 12);
    const employee = await this.employeeModel.findOneAndUpdate({ _id: id, deletedAt: null, role: { $ne: Role.SUPER_ADMIN } }, { passwordHash, refreshTokenHash: null }, { new: true });
    if (!employee) throw new NotFoundException("الموظف غير موجود أو لا يمكن إعادة تعيين رقمه السري");
    return { message: "تم تحديث الرقم السري بنجاح" };
  }

  async remove(id: string, currentUser: AuthUser) {
    if (id === currentUser.id) throw new ForbiddenException("لا يمكنك حذف حسابك الحالي");
    const employee = await this.employeeModel.findOneAndUpdate({ _id: id, deletedAt: null, role: { $ne: Role.SUPER_ADMIN } }, { deletedAt: new Date(), status: EmployeeStatus.INACTIVE, refreshTokenHash: null }, { new: true });
    if (!employee) throw new NotFoundException("الموظف غير موجود أو لا يمكن حذفه");
    return { message: "تم حذف الموظف بنجاح" };
  }
}
