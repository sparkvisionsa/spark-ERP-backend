import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Response } from "express";
import { FilterQuery, Model, Types } from "mongoose";
import { EmployeeStatus, Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { AssignProjectMembersDto, CreateProjectDto, UpdateProjectDto } from "./dto/project.dto";
import { CreateDeliveryDto, CreateItemDto, CreateSubtaskDto, CreateTaskDto, UpdateItemDto, UpdateSubtaskDto, UpdateTaskDto } from "./dto/workspace.dto";
import { Project, ProjectDocument, ProjectStatus, TaskPriority, WorkStatus } from "./schemas/project.schema";
import { DeliveryFilesService, DeliveryUpload } from "./delivery-files.service";

@Injectable()
export class ProjectsService {
  constructor(@InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>, @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>, private readonly deliveryFiles: DeliveryFilesService) {}

  private deliveryFileIds(deliveries: any[]) {
    return deliveries.flatMap((delivery) => (delivery.attachments || []).map((attachment: any) => String(attachment.storageId || ""))).filter(Boolean);
  }

  private scope(user: AuthUser): FilterQuery<ProjectDocument> {
    const filter: FilterQuery<ProjectDocument> = { deletedAt: null };
    if (user.role === Role.SUPERVISOR) filter.company = user.company;
    if (user.role === Role.EMPLOYEE) filter.members = new Types.ObjectId(user.id);
    return filter;
  }

  private ensureCompanyAccess(user: AuthUser, company: string) {
    if (user.role === Role.SUPERVISOR && user.company !== company) throw new ForbiddenException("لا يمكنك إدارة مشاريع شركة أخرى");
  }

  private ensureManager(user: AuthUser) {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.SUPERVISOR) throw new ForbiddenException("لا تملك صلاحية إدارة المشروع");
  }

  private statusProgress(status?: WorkStatus) {
    return status === WorkStatus.COMPLETED ? 100 : status === WorkStatus.IN_PROGRESS ? 50 : 0;
  }

  private subtaskProgress(subtask: any) {
    if (!subtask.items?.length) return this.statusProgress(subtask.manualStatus);
    return Math.round((subtask.items.filter((item: any) => item.done).length / subtask.items.length) * 100);
  }

  private taskProgress(task: any) {
    if (!task.subtasks?.length) return this.statusProgress(task.manualStatus);
    return Math.round(task.subtasks.reduce((sum: number, subtask: any) => sum + this.subtaskProgress(subtask), 0) / task.subtasks.length);
  }

  private derivedStatus(progress: number) {
    return progress === 100 ? WorkStatus.COMPLETED : progress > 0 ? WorkStatus.IN_PROGRESS : WorkStatus.NOT_STARTED;
  }

  private present(raw: any, includeDeliveries = false) {
    const tasks = [...(raw.tasks || [])].sort((a: any, b: any) => a.order - b.order).map((task: any) => {
      const subtasks = [...(task.subtasks || [])].sort((a: any, b: any) => a.order - b.order).map((subtask: any) => {
        const items = [...(subtask.items || [])].sort((a: any, b: any) => a.order - b.order);
        const progress = this.subtaskProgress({ ...subtask, items });
        return { ...subtask, items, progress, derivedStatus: this.derivedStatus(progress), completedItems: items.filter((item: any) => item.done).length };
      });
      const progress = this.taskProgress({ ...task, subtasks });
      return { ...task, subtasks, progress, derivedStatus: this.derivedStatus(progress) };
    });
    const progress = tasks.length ? Math.round(tasks.reduce((sum: number, task: any) => sum + task.progress, 0) / tasks.length) : 0;
    const result = { ...raw, tasks, progress, derivedStatus: this.derivedStatus(progress), totalTasks: tasks.length };
    if (!includeDeliveries) delete result.deliveries;
    return result;
  }

  private async findProject(projectId: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(projectId)) throw new NotFoundException("المشروع غير موجود");
    const project = await this.projectModel.findOne({ _id: projectId, ...this.scope(user) });
    if (!project) throw new NotFoundException("المشروع غير موجود");
    return project;
  }

  private getTask(project: ProjectDocument, taskId: string) {
    const task = (project.tasks as any)?.id(taskId);
    if (!task) throw new NotFoundException("المهمة غير موجودة");
    return task;
  }

  private getSubtask(project: ProjectDocument, subtaskId: string) {
    for (const task of project.tasks as any[]) {
      const subtask = task.subtasks?.id(subtaskId);
      if (subtask) return { task, subtask };
    }
    throw new NotFoundException("المهمة الفرعية غير موجودة");
  }

  private getItem(project: ProjectDocument, itemId: string) {
    for (const task of project.tasks as any[]) for (const subtask of task.subtasks as any[]) {
      const item = subtask.items?.id(itemId);
      if (item) return { task, subtask, item };
    }
    throw new NotFoundException("بند التنفيذ غير موجود");
  }

  private ensureWorker(user: AuthUser, task: any) {
    if (user.role !== Role.EMPLOYEE) return;
    const allowed = String(task.assigneeId) === user.id || (task.helperIds || []).some((id: Types.ObjectId) => String(id) === user.id);
    if (!allowed) throw new ForbiddenException("يمكنك تحديث المهام المسندة إليك فقط");
  }

  private async validateMembers(company: string, memberIds: string[] = []) {
    if (!memberIds.length) return [];
    if (memberIds.some((id) => !Types.ObjectId.isValid(id))) throw new BadRequestException("توجد معرفات موظفين غير صحيحة");
    const employees = await this.employeeModel.find({ _id: { $in: memberIds }, company, deletedAt: null, status: EmployeeStatus.ACTIVE }).select("_id").lean();
    if (employees.length !== new Set(memberIds).size) throw new BadRequestException("كل أعضاء المشروع يجب أن يكونوا موظفين نشطين في الشركة نفسها");
    return employees.map((employee) => employee._id);
  }

  async list(user: AuthUser, company?: string, archived = false) {
    const filter = this.scope(user);
    if (company && user.role === Role.SUPER_ADMIN) filter.company = company;
    filter.status = archived ? ProjectStatus.ARCHIVED : { $ne: ProjectStatus.ARCHIVED };
    const projects = await this.projectModel.find(filter).select("-deliveries").populate({ path: "members", select: "fullName phone role company department jobTitle status", match: { deletedAt: null } }).sort({ createdAt: -1 }).lean();
    return projects.map((project) => this.present(project));
  }

  async get(id: string, user: AuthUser) {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundException("المشروع غير موجود");
    const project = await this.projectModel.findOne({ _id: id, ...this.scope(user) }).populate({ path: "members", select: "fullName phone role company department jobTitle status", match: { deletedAt: null } }).lean();
    if (!project) throw new NotFoundException("المشروع غير موجود");
    return this.present(project);
  }

  async create(dto: CreateProjectDto, user: AuthUser) {
    this.ensureCompanyAccess(user, dto.company);
    const members = await this.validateMembers(dto.company, dto.memberIds);
    return this.projectModel.create({ name: dto.name, company: dto.company, client: dto.client, description: dto.description, startDate: dto.startDate ? new Date(dto.startDate) : null, dueDate: new Date(dto.dueDate), budget: dto.budget, members, createdById: new Types.ObjectId(user.id) });
  }

  async update(id: string, dto: UpdateProjectDto, user: AuthUser) {
    const project = await this.projectModel.findOne({ _id: id, ...this.scope(user) });
    if (!project) throw new NotFoundException("المشروع غير موجود");
    const targetCompany = dto.company || project.company;
    this.ensureCompanyAccess(user, targetCompany);
    const update: Record<string, unknown> = { ...dto };
    delete update.memberIds;
    if (dto.startDate) update.startDate = new Date(dto.startDate);
    if (dto.dueDate) update.dueDate = new Date(dto.dueDate);
    if (dto.memberIds) update.members = await this.validateMembers(targetCompany, dto.memberIds);
    if (dto.status === ProjectStatus.ARCHIVED) update.archivedAt = new Date();
    if (dto.status && dto.status !== ProjectStatus.ARCHIVED) update.archivedAt = null;
    return this.projectModel.findByIdAndUpdate(id, update, { new: true, runValidators: true }).populate({ path: "members", select: "fullName phone role company department jobTitle status", match: { deletedAt: null } });
  }

  async assignMembers(id: string, dto: AssignProjectMembersDto, user: AuthUser) {
    const project = await this.projectModel.findOne({ _id: id, ...this.scope(user) });
    if (!project) throw new NotFoundException("المشروع غير موجود");
    this.ensureCompanyAccess(user, project.company);
    project.members = await this.validateMembers(project.company, dto.memberIds) as Types.ObjectId[];
    await project.save();
    return project.populate({ path: "members", select: "fullName phone role company department jobTitle status", match: { deletedAt: null } });
  }

  async remove(id: string, user: AuthUser) {
    const project = await this.projectModel.findOne({ _id: id, ...this.scope(user) });
    if (!project) throw new NotFoundException("المشروع غير موجود");
    this.ensureCompanyAccess(user, project.company);
    project.deletedAt = new Date();
    await project.save();
    return { message: "تم حذف المشروع بنجاح" };
  }

  async workspace(projectId: string, user: AuthUser) {
    const project = await this.findProject(projectId, user);
    await project.populate([
      { path: "members", select: "fullName phone role company department jobTitle status", match: { deletedAt: null } },
      { path: "deliveries.authorId", select: "fullName role company" }
    ]);
    const raw: any = project.toObject();
    // Keep the workspace contract stable even when an old project contains a
    // dangling reference to a soft-deleted employee that Mongoose cannot populate.
    raw.members = (raw.members || []).filter((member: any) => member && typeof member === "object" && member._id && typeof member.fullName === "string");
    return this.present(raw, true);
  }

  async createTask(dto: CreateTaskDto, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(dto.projectId, user);
    this.ensureCompanyAccess(user, project.company);
    if (!Types.ObjectId.isValid(dto.assigneeId) || !(project.members || []).some((id) => String(id) === dto.assigneeId)) throw new BadRequestException("الموظف المسؤول يجب أن يكون ضمن فريق المشروع");
    const helperIds = dto.helperIds || [];
    if (helperIds.some((id) => !Types.ObjectId.isValid(id) || !(project.members || []).some((memberId) => String(memberId) === id))) throw new BadRequestException("الفريق المساعد يجب أن يكون ضمن فريق المشروع");
    (project.tasks as any[]).push({
      title: dto.title.trim(), description: dto.description?.trim() || "", assigneeId: new Types.ObjectId(dto.assigneeId),
      helperIds: helperIds.map((id) => new Types.ObjectId(id)), priority: dto.priority || TaskPriority.NORMAL,
      dueDate: new Date(dto.dueDate), order: project.tasks.length,
      subtasks: (dto.subtaskTitles || []).filter((title) => title.trim()).map((title, order) => ({ title: title.trim(), order, items: [] }))
    });
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async updateTask(taskId: string, dto: UpdateTaskDto, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(dto.projectId, user);
    const task = this.getTask(project, taskId);
    if (dto.assigneeId) {
      if (!Types.ObjectId.isValid(dto.assigneeId) || !project.members.some((id) => String(id) === dto.assigneeId)) throw new BadRequestException("الموظف المسؤول يجب أن يكون ضمن فريق المشروع");
      task.assigneeId = new Types.ObjectId(dto.assigneeId);
    }
    if (dto.helperIds) {
      if (dto.helperIds.some((id) => !Types.ObjectId.isValid(id) || !project.members.some((memberId) => String(memberId) === id))) throw new BadRequestException("الفريق المساعد يجب أن يكون ضمن فريق المشروع");
      task.helperIds = dto.helperIds.map((id) => new Types.ObjectId(id));
    }
    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description.trim();
    if (dto.priority !== undefined) task.priority = dto.priority;
    if (dto.dueDate !== undefined) task.dueDate = new Date(dto.dueDate);
    if (dto.manualStatus !== undefined) task.manualStatus = dto.manualStatus;
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async deleteTask(taskId: string, projectId: string, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(projectId, user);
    const task = this.getTask(project, taskId);
    const removed = (project.deliveries || []).filter((delivery) => delivery.taskId === taskId);
    task.deleteOne();
    project.deliveries = (project.deliveries || []).filter((delivery) => delivery.taskId !== taskId);
    await project.save();
    await this.deliveryFiles.removeMany(this.deliveryFileIds(removed as any[]));
    return this.workspace(projectId, user);
  }

  async createSubtask(taskId: string, dto: CreateSubtaskDto, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(dto.projectId, user);
    const task = this.getTask(project, taskId);
    task.subtasks.push({ title: dto.title.trim(), order: task.subtasks.length, items: (dto.itemTexts || []).filter((text) => text.trim()).map((text, order) => ({ text: text.trim(), order })) });
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async updateSubtask(subtaskId: string, dto: UpdateSubtaskDto, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(dto.projectId, user);
    const { subtask } = this.getSubtask(project, subtaskId);
    if (dto.title !== undefined) subtask.title = dto.title.trim();
    if (dto.manualStatus !== undefined) subtask.manualStatus = dto.manualStatus;
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async deleteSubtask(subtaskId: string, projectId: string, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(projectId, user);
    const { subtask } = this.getSubtask(project, subtaskId);
    const removed = (project.deliveries || []).filter((delivery) => delivery.subtaskId === subtaskId);
    subtask.deleteOne();
    project.deliveries = (project.deliveries || []).filter((delivery) => delivery.subtaskId !== subtaskId);
    await project.save();
    await this.deliveryFiles.removeMany(this.deliveryFileIds(removed as any[]));
    return this.workspace(projectId, user);
  }

  async createItem(subtaskId: string, dto: CreateItemDto, user: AuthUser) {
    const project = await this.findProject(dto.projectId, user);
    const { task, subtask } = this.getSubtask(project, subtaskId);
    if (user.role === Role.EMPLOYEE) this.ensureWorker(user, task); else this.ensureManager(user);
    subtask.items.push({ text: dto.text.trim(), done: false, attachments: 0, order: subtask.items.length });
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async updateItem(itemId: string, dto: UpdateItemDto, user: AuthUser) {
    const project = await this.findProject(dto.projectId, user);
    const { task, item } = this.getItem(project, itemId);
    this.ensureWorker(user, task);
    if (dto.text !== undefined) item.text = dto.text.trim();
    if (dto.done !== undefined) item.done = dto.done;
    await project.save();
    return this.workspace(dto.projectId, user);
  }

  async deleteItem(itemId: string, projectId: string, user: AuthUser) {
    this.ensureManager(user);
    const project = await this.findProject(projectId, user);
    const { item } = this.getItem(project, itemId);
    const removed = (project.deliveries || []).filter((delivery) => delivery.itemId === itemId);
    item.deleteOne();
    project.deliveries = (project.deliveries || []).filter((delivery) => delivery.itemId !== itemId);
    await project.save();
    await this.deliveryFiles.removeMany(this.deliveryFileIds(removed as any[]));
    return this.workspace(projectId, user);
  }

  async createDelivery(dto: CreateDeliveryDto, user: AuthUser, uploads: DeliveryUpload[] = []) {
    if (!dto.text?.trim() && !dto.link?.trim() && !dto.attachmentName?.trim() && !uploads.length) throw new BadRequestException("أضف نصاً أو رابطاً أو ملفاً للتسليم");
    this.deliveryFiles.validate(uploads);
    const project = await this.findProject(dto.projectId, user);
    const task = this.getTask(project, dto.taskId);
    this.ensureWorker(user, task);
    if (dto.subtaskId) {
      const target = this.getSubtask(project, dto.subtaskId);
      if (String(target.task._id) !== dto.taskId) throw new BadRequestException("المهمة الفرعية لا تتبع المهمة المحددة");
    }
    if (dto.itemId) {
      const target = this.getItem(project, dto.itemId);
      if (String(target.task._id) !== dto.taskId) throw new BadRequestException("بند التنفيذ لا يتبع المهمة المحددة");
    }
    const attachments = await this.deliveryFiles.storeMany(uploads, user.id);
    try {
      const firstKind = attachments[0]?.kind;
      (project.deliveries as any[]).push({ authorId: new Types.ObjectId(user.id), taskId: dto.taskId, subtaskId: dto.subtaskId || null, itemId: dto.itemId || null, text: dto.text?.trim() || "", link: dto.link?.trim() || "", attachmentName: dto.attachmentName?.trim() || attachments[0]?.name || "", attachmentType: dto.attachmentType || (dto.link ? "link" : firstKind === "image" || firstKind === "video" ? firstKind : attachments.length ? "file" : ""), attachments });
      if (dto.itemId) {
        const { item } = this.getItem(project, dto.itemId);
        item.attachments = (item.attachments || 0) + 1;
      }
      await project.save();
    } catch (error) {
      await this.deliveryFiles.removeMany(attachments.map((attachment) => attachment.storageId));
      throw error;
    }
    return this.workspace(dto.projectId, user);
  }

  async sendDeliveryFile(fileId: string, user: AuthUser, response: Response, range?: string, download = false) {
    if (!Types.ObjectId.isValid(fileId)) throw new NotFoundException("الملف غير موجود");
    const allowed = await this.projectModel.exists({ ...this.scope(user), "deliveries.attachments.storageId": fileId });
    if (!allowed) throw new NotFoundException("الملف غير موجود أو لا تملك صلاحية الوصول إليه");
    return this.deliveryFiles.send(fileId, response, range, download);
  }

  async listDeliveries(projectId: string, user: AuthUser, filters: { taskId?: string; subtaskId?: string; itemId?: string }) {
    const tree: any = await this.workspace(projectId, user);
    return (tree.deliveries || []).filter((delivery: any) => (!filters.taskId || delivery.taskId === filters.taskId) && (!filters.subtaskId || delivery.subtaskId === filters.subtaskId) && (!filters.itemId || delivery.itemId === filters.itemId));
  }

  async deleteDelivery(deliveryId: string, projectId: string, user: AuthUser) {
    const project = await this.findProject(projectId, user);
    const delivery = (project.deliveries as any)?.id(deliveryId);
    if (!delivery) throw new NotFoundException("التسليم غير موجود");
    if (user.role === Role.EMPLOYEE && String(delivery.authorId) !== user.id) throw new ForbiddenException("يمكن حذف تسليماتك فقط");
    const fileIds = this.deliveryFileIds([delivery]);
    if (delivery.itemId) {
      const { item } = this.getItem(project, delivery.itemId);
      item.attachments = Math.max(0, (item.attachments || 0) - 1);
    }
    delivery.deleteOne();
    await project.save();
    await this.deliveryFiles.removeMany(fileIds);
    return this.workspace(projectId, user);
  }
}
