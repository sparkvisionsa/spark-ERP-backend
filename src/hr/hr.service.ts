import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { EmployeeStatus, Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { Project, ProjectDocument, ProjectStatus, WorkPauseReason, WorkStatus } from "../projects/schemas/project.schema";
import { Company, CompanyDocument } from "../companies/schemas/company.schema";
import { CreateAttendanceDto, CreateEmployeeDocumentDto, CreateLeaveDto, UpdateLeaveStatusDto } from "./dto/hr.dto";
import { AttendanceCheckInStatus, AttendanceCheckOutStatus, AttendanceStatus, AttendanceWorkReference, HrRecord, HrRecordDocument } from "./schemas/hr-record.schema";

type WorkCandidate = {
  project: ProjectDocument;
  task: any;
  subtask: any;
  reference: AttendanceWorkReference;
  timestamp: number;
};

@Injectable()
export class HrService {
  private readonly minimumShiftSeconds = 9 * 60 * 60;
  private readonly attendanceToleranceMs = 15 * 60 * 1000;
  private readonly officialHours = { start: "08:00", end: "17:00", timeZone: "Asia/Riyadh" } as const;

  constructor(
    @InjectModel(HrRecord.name) private readonly hrModel: Model<HrRecordDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Company.name) private readonly companyModel: Model<CompanyDocument>,
  ) {}

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

  private riyadhDateKey(date: Date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((entry) => entry.type === type)?.value || "";
    return `${part("year")}-${part("month")}-${part("day")}`;
  }

  private riyadhTime(date: Date) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Riyadh", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  }

  private officialSchedule(dateKey: string) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
    if (!match) throw new BadRequestException("تاريخ الدوام غير صالح");
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    // Riyadh is UTC+3 year-round: 08:00-17:00 equals 05:00-14:00 UTC.
    return {
      startAt: new Date(Date.UTC(year, month - 1, day, 5, 0, 0, 0)),
      endAt: new Date(Date.UTC(year, month - 1, day, 14, 0, 0, 0)),
    };
  }

  private checkInTiming(now: Date, startAt: Date, endAt: Date) {
    if (now.getTime() < startAt.getTime() - this.attendanceToleranceMs) return AttendanceCheckInStatus.EARLY;
    if (now.getTime() <= startAt.getTime() + this.attendanceToleranceMs) return AttendanceCheckInStatus.ON_TIME;
    if (now < endAt) return AttendanceCheckInStatus.LATE;
    return AttendanceCheckInStatus.AFTER_HOURS;
  }

  private checkOutTiming(now: Date, endAt: Date) {
    if (now.getTime() < endAt.getTime() - this.attendanceToleranceMs) return AttendanceCheckOutStatus.EARLY;
    if (now.getTime() <= endAt.getTime() + this.attendanceToleranceMs) return AttendanceCheckOutStatus.ON_TIME;
    return AttendanceCheckOutStatus.OVERTIME;
  }

  private scheduleForRecord(record: any, fallback: Date) {
    const dateKey = record?.dateKey || this.riyadhDateKey(record?.checkedInAt ? new Date(record.checkedInAt) : fallback);
    return this.officialSchedule(dateKey);
  }

  private automatedRecords(record: HrRecordDocument | null) {
    return ((record?.attendance || []) as any[])
      .filter((entry) => Boolean(entry.checkedInAt))
      .sort((a, b) => new Date(a.checkedInAt).getTime() - new Date(b.checkedInAt).getTime());
  }

  private openShift(record: HrRecordDocument | null) {
    return [...this.automatedRecords(record)].reverse().find((entry) => entry.status === AttendanceStatus.WORKING && !entry.checkedOutAt) || null;
  }

  private activeBreak(shift: any) {
    return [...(shift?.breaks || [])].reverse().find((entry: any) => entry.startedAt && !entry.endedAt) || null;
  }

  private breakSeconds(shift: any, now: Date) {
    return (shift?.breaks || []).reduce((total: number, entry: any) => {
      if (!entry.startedAt) return total;
      const endAt = entry.endedAt ? new Date(entry.endedAt) : now;
      return total + Math.max(0, Math.floor((endAt.getTime() - new Date(entry.startedAt).getTime()) / 1000));
    }, 0);
  }

  private workReference(project: any, task: any, subtask: any, pausedAutomatically = false): AttendanceWorkReference {
    return {
      projectId: String(project._id), projectName: project.name || "",
      taskId: String(task._id), taskTitle: task.title || "",
      subtaskId: String(subtask._id), subtaskTitle: subtask.title || "",
      pausedAutomatically,
    };
  }

  private employeeOwnsDetail(task: any, subtask: any, employeeId: string) {
    const explicitOwner = subtask.startedById || subtask.lastWorkedById;
    if (explicitOwner) return String(explicitOwner) === employeeId;
    return String(task.assigneeId) === employeeId;
  }

  private async activeWork(employeeId: string) {
    const projects = await this.projectModel.find({
      deletedAt: null, status: ProjectStatus.ACTIVE, members: new Types.ObjectId(employeeId),
      "tasks.subtasks.manualStatus": WorkStatus.IN_PROGRESS,
    });
    for (const project of projects) for (const task of project.tasks as any[]) for (const subtask of task.subtasks as any[]) {
      if (subtask.manualStatus === WorkStatus.IN_PROGRESS && this.employeeOwnsDetail(task, subtask, employeeId)) {
        return this.workReference(project, task, subtask);
      }
    }
    return null;
  }

  private latestStoredWork(record: HrRecordDocument) {
    return [...this.automatedRecords(record)].reverse().find((entry) => entry.pausedWork)?.pausedWork || null;
  }

  private async pausedCandidate(employeeId: string, preferred?: AttendanceWorkReference | null): Promise<WorkCandidate | null> {
    const projects = await this.projectModel.find({
      deletedAt: null, status: ProjectStatus.ACTIVE, members: new Types.ObjectId(employeeId),
      "tasks.subtasks.manualStatus": WorkStatus.PAUSED,
    });
    const candidates: WorkCandidate[] = [];
    for (const project of projects) for (const task of project.tasks as any[]) for (const subtask of task.subtasks as any[]) {
      if (subtask.manualStatus !== WorkStatus.PAUSED || !this.employeeOwnsDetail(task, subtask, employeeId)) continue;
      const candidate = {
        project, task, subtask, reference: this.workReference(project, task, subtask, subtask.pauseReason === WorkPauseReason.ATTENDANCE_CHECKOUT || subtask.pauseReason === WorkPauseReason.ATTENDANCE_BREAK),
        timestamp: new Date(subtask.pausedAt || subtask.firstStartedAt || 0).getTime(),
      };
      if (preferred && candidate.reference.projectId === preferred.projectId && candidate.reference.subtaskId === preferred.subtaskId) return candidate;
      candidates.push(candidate);
    }
    return candidates.sort((a, b) => b.timestamp - a.timestamp)[0] || null;
  }

  private async resumePausedWork(employeeId: string, record: HrRecordDocument, preferred?: AttendanceWorkReference | null) {
    if (await this.activeWork(employeeId)) return null;
    const candidate = await this.pausedCandidate(employeeId, preferred || this.latestStoredWork(record));
    if (!candidate) return null;
    const now = new Date();
    candidate.subtask.manualStatus = WorkStatus.IN_PROGRESS;
    candidate.subtask.startedAt = now;
    candidate.subtask.startedById = new Types.ObjectId(employeeId);
    candidate.subtask.lastWorkedById = new Types.ObjectId(employeeId);
    candidate.subtask.pausedAt = null;
    candidate.subtask.pauseReason = null;
    if (!candidate.subtask.firstStartedAt) candidate.subtask.firstStartedAt = now;
    candidate.task.manualStatus = WorkStatus.IN_PROGRESS;
    await candidate.project.save();
    return candidate.reference;
  }

  private async pauseActiveWork(employeeId: string, reason: WorkPauseReason = WorkPauseReason.ATTENDANCE_CHECKOUT) {
    const now = new Date();
    const projects = await this.projectModel.find({
      deletedAt: null, status: ProjectStatus.ACTIVE, members: new Types.ObjectId(employeeId),
      "tasks.subtasks.manualStatus": WorkStatus.IN_PROGRESS,
    });
    const paused: Array<{ reference: AttendanceWorkReference; timestamp: number }> = [];
    for (const project of projects) {
      let changed = false;
      for (const task of project.tasks as any[]) {
        let taskChanged = false;
        for (const subtask of task.subtasks as any[]) {
          if (subtask.manualStatus !== WorkStatus.IN_PROGRESS || !this.employeeOwnsDetail(task, subtask, employeeId)) continue;
          const startedAt = subtask.startedAt ? new Date(subtask.startedAt).getTime() : now.getTime();
          subtask.elapsedSeconds = (subtask.elapsedSeconds || 0) + Math.max(0, Math.floor((now.getTime() - startedAt) / 1000));
          subtask.manualStatus = WorkStatus.PAUSED;
          subtask.lastWorkedById = new Types.ObjectId(employeeId);
          subtask.startedAt = null;
          subtask.startedById = null;
          subtask.pausedAt = now;
          subtask.pauseReason = reason;
          paused.push({ reference: this.workReference(project, task, subtask, true), timestamp: startedAt });
          changed = true;
          taskChanged = true;
        }
        if (taskChanged) {
          task.manualStatus = (task.subtasks || []).some((subtask: any) => subtask.manualStatus === WorkStatus.IN_PROGRESS)
            ? WorkStatus.IN_PROGRESS
            : WorkStatus.PAUSED;
        }
      }
      if (changed) await project.save();
    }
    return paused.sort((a, b) => b.timestamp - a.timestamp)[0]?.reference || null;
  }

  private statusPayload(record: HrRecordDocument | null, now: Date, activeWork: AttendanceWorkReference | null = null) {
    const open = this.openShift(record);
    const records = this.automatedRecords(record);
    const latest = records[records.length - 1] || null;
    if (open) {
      const checkedInAt = new Date(open.checkedInAt);
      const schedule = this.scheduleForRecord(open, checkedInAt);
      const workedSeconds = Math.max(0, Math.floor((now.getTime() - checkedInAt.getTime()) / 1000));
      const remainingSeconds = Math.max(0, Math.ceil((schedule.endAt.getTime() - now.getTime()) / 1000));
      const activeBreak = this.activeBreak(open);
      return {
        state: remainingSeconds ? "WORKING" : "CHECKOUT_AVAILABLE", serverNow: now,
        minimumShiftSeconds: this.minimumShiftSeconds, workedSeconds, remainingSeconds,
        breakSeconds: this.breakSeconds(open, now),
        overtimeSeconds: Math.max(0, Math.floor((now.getTime() - (schedule.endAt.getTime() + this.attendanceToleranceMs)) / 1000)),
        canCheckOut: true, checkedInAt, checkoutAvailableAt: checkedInAt, checkedOutAt: null,
        officialStartAt: schedule.startAt, officialEndAt: schedule.endAt, officialHours: this.officialHours,
        checkInStatus: open.checkInStatus || this.checkInTiming(checkedInAt, schedule.startAt, schedule.endAt),
        checkIn: open.checkIn, checkOut: "", checkOutStatus: null,
        activeBreak: activeBreak ? { startedAt: activeBreak.startedAt } : null,
        activeWork,
      };
    }
    const completedToday = latest?.status === AttendanceStatus.COMPLETED && latest.dateKey === this.riyadhDateKey(now);
    const schedule = this.scheduleForRecord(completedToday ? latest : null, now);
    return {
      state: completedToday ? "COMPLETED" : "NOT_CLOCKED_IN", serverNow: now,
      minimumShiftSeconds: this.minimumShiftSeconds, workedSeconds: completedToday && latest.checkedInAt && latest.checkedOutAt
        ? Math.max(0, Math.floor((new Date(latest.checkedOutAt).getTime() - new Date(latest.checkedInAt).getTime()) / 1000)) : 0,
      remainingSeconds: 0, canCheckOut: false,
      breakSeconds: completedToday ? this.breakSeconds(latest, new Date(latest.checkedOutAt)) : 0,
      overtimeSeconds: completedToday && latest.checkedOutAt
        ? Math.max(0, Math.floor((new Date(latest.checkedOutAt).getTime() - (schedule.endAt.getTime() + this.attendanceToleranceMs)) / 1000))
        : 0,
      checkedInAt: completedToday ? latest.checkedInAt : null,
      checkoutAvailableAt: schedule.endAt,
      officialStartAt: schedule.startAt, officialEndAt: schedule.endAt, officialHours: this.officialHours,
      checkInStatus: completedToday ? latest.checkInStatus || this.checkInTiming(new Date(latest.checkedInAt), schedule.startAt, schedule.endAt) : null,
      checkOutStatus: completedToday && latest.checkedOutAt
        ? latest.checkOutStatus || this.checkOutTiming(new Date(latest.checkedOutAt), schedule.endAt)
        : null,
      checkedOutAt: completedToday ? latest.checkedOutAt : null,
      checkIn: completedToday ? latest.checkIn : "", checkOut: completedToday ? latest.checkOut : "", activeBreak: null, activeWork: null,
    };
  }

  async attendanceStatus(user: AuthUser) {
    await this.ensureAccess(user.id, user);
    const record = await this.hrModel.findOne({ employeeId: user.id });
    const active = this.openShift(record) ? await this.activeWork(user.id) : null;
    return this.statusPayload(record, new Date(), active);
  }

  async attendanceOverview() {
    const now = new Date();
    const [companies, employees] = await Promise.all([
      this.companyModel.find({ active: true }).sort({ name: 1 }).lean(),
      this.employeeModel.find({
        deletedAt: null,
        status: EmployeeStatus.ACTIVE,
        role: { $in: [Role.SUPERVISOR, Role.EMPLOYEE] },
      }).select("fullName role company department jobTitle status").lean(),
    ]);
    const employeeIds = employees.map((employee) => employee._id);
    const records = employeeIds.length
      ? await this.hrModel.find({ employeeId: { $in: employeeIds } }).lean()
      : [];
    const recordsByEmployee = new Map(records.map((record) => [String(record.employeeId), record]));
    const rows = employees.map((employee) => {
      const attendance = this.statusPayload(recordsByEmployee.get(String(employee._id)) as HrRecordDocument | null, now);
      return {
        id: String(employee._id),
        fullName: employee.fullName,
        role: employee.role,
        company: employee.company,
        department: employee.department || "",
        jobTitle: employee.jobTitle || "",
        employeeStatus: employee.status,
        attendance: {
          state: attendance.state,
          workedSeconds: attendance.workedSeconds,
          checkedInAt: attendance.checkedInAt,
          checkoutAvailableAt: attendance.checkoutAvailableAt,
          checkedOutAt: attendance.checkedOutAt,
          checkIn: attendance.checkIn,
          checkOut: attendance.checkOut,
          checkInStatus: attendance.checkInStatus,
          checkOutStatus: attendance.checkOutStatus,
          breakSeconds: attendance.breakSeconds,
          overtimeSeconds: attendance.overtimeSeconds,
          activeBreak: attendance.activeBreak,
        },
      };
    }).sort((a, b) => {
      if (a.role !== b.role) return a.role === Role.SUPERVISOR ? -1 : 1;
      return a.fullName.localeCompare(b.fullName, "ar");
    });
    const companyRows = companies.map((company) => ({
      key: company.key,
      name: company.name,
      color: company.color || "#7A2838",
      employees: rows.filter((employee) => employee.company === company.key),
    }));
    const states = rows.map((employee) => employee.attendance.state);
    return {
      generatedAt: now,
      officialHours: this.officialHours,
      summary: {
        total: rows.length,
        working: states.filter((state) => state === "WORKING" || state === "CHECKOUT_AVAILABLE").length,
        completed: states.filter((state) => state === "COMPLETED").length,
        notClockedIn: states.filter((state) => state === "NOT_CLOCKED_IN").length,
      },
      companies: companyRows,
    };
  }

  async checkIn(user: AuthUser) {
    const record = await this.record(user.id);
    if (this.openShift(record)) throw new BadRequestException("تم بدء الدوام بالفعل");
    const now = new Date();
    const dateKey = this.riyadhDateKey(now);
    const schedule = this.officialSchedule(dateKey);
    if (this.automatedRecords(record).some((entry) => entry.dateKey === dateKey && entry.status === AttendanceStatus.COMPLETED)) {
      throw new BadRequestException("تم إكمال دوام اليوم بالفعل");
    }
    const entry: any = {
      date: now, dateKey, checkIn: this.riyadhTime(now), checkOut: "", notes: "تسجيل ذاتي من الموظف",
      checkedInAt: now, checkoutAvailableAt: now,
      officialStartAt: schedule.startAt, officialEndAt: schedule.endAt,
      checkInStatus: this.checkInTiming(now, schedule.startAt, schedule.endAt),
      checkedOutAt: null, status: AttendanceStatus.WORKING, breaks: [], pausedWork: null, resumedWork: null,
    };
    (record.attendance as any[]).push(entry);
    await record.save();
    const resumedWork = await this.resumePausedWork(user.id, record);
    const savedEntry = this.openShift(record);
    if (resumedWork && savedEntry) {
      savedEntry.resumedWork = resumedWork;
      await record.save();
    }
    const active = resumedWork || await this.activeWork(user.id);
    return { ...this.statusPayload(record, new Date(), active), action: "CHECKED_IN", resumedWork };
  }

  async checkOut(user: AuthUser) {
    const record = await this.record(user.id);
    const shift = this.openShift(record);
    if (!shift) throw new BadRequestException("لا يوجد دوام مفتوح لإنهائه");
    const now = new Date();
    const schedule = this.scheduleForRecord(shift, new Date(shift.checkedInAt));
    const currentBreak = this.activeBreak(shift);
    if (currentBreak) {
      currentBreak.endedAt = now;
      currentBreak.durationSeconds = Math.max(0, Math.floor((now.getTime() - new Date(currentBreak.startedAt).getTime()) / 1000));
    }
    const pausedWork = currentBreak?.pausedWork
      || await this.pauseActiveWork(user.id)
      || await this.pausedCandidate(user.id).then((candidate) => candidate?.reference || null);
    shift.checkedOutAt = now;
    shift.checkOut = this.riyadhTime(now);
    shift.checkOutStatus = this.checkOutTiming(now, schedule.endAt);
    shift.status = AttendanceStatus.COMPLETED;
    shift.pausedWork = pausedWork;
    await record.save();
    return { ...this.statusPayload(record, new Date()), action: "CHECKED_OUT", pausedWork };
  }

  async startBreak(user: AuthUser) {
    const record = await this.record(user.id);
    const shift = this.openShift(record);
    if (!shift) throw new BadRequestException("يجب بدء الدوام قبل بدء البريك");
    if (this.activeBreak(shift)) throw new BadRequestException("أنت في بريك بالفعل");
    const pausedWork = await this.pauseActiveWork(user.id, WorkPauseReason.ATTENDANCE_BREAK);
    const startedAt = new Date();
    if (!Array.isArray(shift.breaks)) shift.breaks = [];
    shift.breaks.push({ startedAt, endedAt: null, durationSeconds: 0, pausedWork });
    await record.save();
    return { ...this.statusPayload(record, new Date()), action: "BREAK_STARTED", pausedWork };
  }

  async endBreak(user: AuthUser) {
    const record = await this.record(user.id);
    const shift = this.openShift(record);
    if (!shift) throw new BadRequestException("لا يوجد دوام مفتوح");
    const currentBreak = this.activeBreak(shift);
    if (!currentBreak) throw new BadRequestException("لا يوجد بريك نشط لإنهائه");
    const endedAt = new Date();
    currentBreak.endedAt = endedAt;
    currentBreak.durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - new Date(currentBreak.startedAt).getTime()) / 1000));
    const pausedWork = currentBreak.pausedWork || null;
    await record.save();
    const resumedWork = await this.resumePausedWork(user.id, record, pausedWork);
    return { ...this.statusPayload(record, new Date(), resumedWork || await this.activeWork(user.id)), action: "BREAK_ENDED", resumedWork };
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
    const date = new Date(dto.date);
    record.attendance.push({ date, dateKey: this.riyadhDateKey(date), checkIn: dto.checkIn || "", checkOut: dto.checkOut || "", notes: dto.notes?.trim() || "" } as any);
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
