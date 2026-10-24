import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { CreateAttendanceDto, CreateEmployeeDocumentDto, CreateLeaveDto, UpdateLeaveStatusDto } from "./dto/hr.dto";
import { HrRecord, HrRecordDocument } from "./schemas/hr-record.schema";

@Injectable()
export class HrService {
  constructor(@InjectModel(HrRecord.name) private readonly hrModel: Model<HrRecordDocument>, @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>) {}

  private async ensureAccess(employeeId: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(employeeId)) throw new NotFoundException("الموظف غير موجود");
    const employee = await this.employeeModel.findOne({ _id: employeeId, deletedAt: null }).select("company").lean();
    if (!employee) throw new NotFoundException("الموظف غير موجود");
    if (user.role === Role.EMPLOYEE && employeeId !== user.id) throw new ForbiddenException("يمكنك عرض سجلاتك فقط");
    if (user.role === Role.SUPERVISOR && employee.company !== user.company) throw new ForbiddenException("لا يمكنك عرض سجلات شركة أخرى");
  }

  private async record(employeeId: string) {
    if (!Types.ObjectId.isValid(employeeId) || !(await this.employeeModel.exists({ _id: employeeId, deletedAt: null }))) throw new NotFoundException("الموظف غير موجود");
    return this.hrModel.findOneAndUpdate({ employeeId }, { $setOnInsert: { employeeId } }, { upsert: true, new: true, setDefaultsOnInsert: true });
  }

  async get(employeeId: string, user: AuthUser) {
    await this.ensureAccess(employeeId, user);
    const record = await this.hrModel.findOne({ employeeId }).lean();
    return record || { employeeId, leaves: [], attendance: [], documents: [] };
  }

  async addLeave(employeeId: string, dto: CreateLeaveDto) {
    const startDate = new Date(dto.startDate); const endDate = new Date(dto.endDate);
    if (endDate < startDate) throw new BadRequestException("تاريخ نهاية الإجازة يجب أن يكون بعد بدايتها");
    const record = await this.record(employeeId);
    record.leaves.push({ type: dto.type.trim(), startDate, endDate, notes: dto.notes?.trim() || "" } as any);
    await record.save(); return record;
  }

  async updateLeave(employeeId: string, leaveId: string, dto: UpdateLeaveStatusDto, user: AuthUser) {
    const record = await this.record(employeeId); const leave = (record.leaves as any).id(leaveId);
    if (!leave) throw new NotFoundException("سجل الإجازة غير موجود");
    leave.status = dto.status; leave.reviewedById = new Types.ObjectId(user.id); await record.save(); return record;
  }

  async addAttendance(employeeId: string, dto: CreateAttendanceDto) {
    const record = await this.record(employeeId);
    const dateKey = dto.date.slice(0, 10);
    const duplicate = (record.attendance || []).some((entry: any) => new Date(entry.date).toISOString().slice(0, 10) === dateKey);
    if (duplicate) throw new BadRequestException("يوجد سجل حضور لهذا الموظف في التاريخ نفسه");
    record.attendance.push({ date: new Date(dto.date), checkIn: dto.checkIn || "", checkOut: dto.checkOut || "", notes: dto.notes?.trim() || "" } as any);
    await record.save(); return record;
  }

  async addDocument(employeeId: string, dto: CreateEmployeeDocumentDto) {
    const record = await this.record(employeeId);
    record.documents.push({ name: dto.name.trim(), type: dto.type?.trim() || "عام", url: dto.url?.trim() || "", expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, notes: dto.notes?.trim() || "" } as any);
    await record.save(); return record;
  }

  async remove(employeeId: string, collection: "leaves" | "attendance" | "documents", recordId: string) {
    if (!["leaves", "attendance", "documents"].includes(collection)) throw new BadRequestException("نوع السجل غير صالح");
    const record = await this.record(employeeId); const item = (record[collection] as any).id(recordId);
    if (!item) throw new NotFoundException("السجل غير موجود");
    item.deleteOne(); await record.save(); return record;
  }
}
