import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AddDepartmentDto, CreateCompanyDto, UpdateCompanyDto, UpdateDepartmentDto } from "./dto/company.dto";
import { Company, CompanyDocument } from "./schemas/company.schema";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { Project, ProjectDocument } from "../projects/schemas/project.schema";

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
  ) {}
  list() { return this.companyModel.find({ active: true }).sort({ createdAt: 1 }).lean(); }
  async create(dto: CreateCompanyDto) {
    const key = dto.key?.trim().toLowerCase() || `company-${Date.now()}`;
    if (await this.companyModel.exists({ key })) throw new ConflictException("رمز الشركة مستخدم مسبقًا");
    return this.companyModel.create({ name: dto.name.trim(), key, logoUrl: dto.logoUrl?.trim() || "", color: dto.color || "#7A2838", departments: [...new Set((dto.departments || []).map((name) => name.trim()).filter(Boolean))].map((name) => ({ name })) });
  }
  async update(key: string, dto: UpdateCompanyDto) {
    const company = await this.companyModel.findOneAndUpdate({ key }, dto, { new: true, runValidators: true });
    if (!company) throw new NotFoundException("الشركة غير موجودة");
    return company;
  }
  async remove(key: string) {
    const company = await this.companyModel.findOne({ key });
    if (!company) throw new NotFoundException("الشركة غير موجودة");
    const [employeeCount, projectCount] = await Promise.all([
      this.employeeModel.countDocuments({ company: key, deletedAt: null }),
      this.projectModel.countDocuments({ company: key, deletedAt: null }),
    ]);
    if (employeeCount || projectCount) {
      throw new BadRequestException(`لا يمكن حذف الشركة لارتباطها بـ ${employeeCount} موظف و${projectCount} مشروع. انقل البيانات أو احذفها أولاً.`);
    }
    await company.deleteOne();
    return { message: "تم حذف الشركة" };
  }
  async addDepartment(key: string, dto: AddDepartmentDto) {
    const name = dto.name.trim();
    const company = await this.companyModel.findOne({ key });
    if (!company) throw new NotFoundException("الشركة غير موجودة");
    if (!(company.departments || []).some((department) => department.name === name)) company.departments.push({ name });
    await company.save();
    return company;
  }
  async updateDepartment(key: string, currentName: string, dto: UpdateDepartmentDto) {
    const name = dto.name.trim();
    const company = await this.companyModel.findOne({ key });
    if (!company) throw new NotFoundException("الشركة غير موجودة");
    const department = (company.departments || []).find((entry) => entry.name === currentName);
    if (!department) throw new NotFoundException("القسم غير موجود");
    if (name !== currentName && (company.departments || []).some((entry) => entry.name === name)) throw new ConflictException("يوجد قسم بالاسم نفسه بالفعل");
    if (name !== currentName) {
      department.name = name;
      await this.employeeModel.updateMany({ company: key, department: currentName, deletedAt: null }, { $set: { department: name } });
      await company.save();
    }
    return company;
  }
  async removeDepartment(key: string, name: string) {
    const company = await this.companyModel.findOne({ key });
    if (!company) throw new NotFoundException("الشركة غير موجودة");
    const index = (company.departments || []).findIndex((entry) => entry.name === name);
    if (index < 0) throw new NotFoundException("القسم غير موجود");
    const employeeCount = await this.employeeModel.countDocuments({ company: key, department: name, deletedAt: null });
    if (employeeCount) throw new BadRequestException(`لا يمكن حذف القسم لارتباطه بـ ${employeeCount} موظف. انقل الموظفين إلى قسم آخر أولاً.`);
    company.departments.splice(index, 1);
    await company.save();
    return company;
  }
}
