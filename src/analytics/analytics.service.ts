import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { FilterQuery, Model, Types } from "mongoose";
import { CompanyKey, EmployeeStatus, Role } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { Project, ProjectDocument, ProjectStatus, WorkStatus } from "../projects/schemas/project.schema";

type AnyRecord = Record<string, any>;

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>
  ) {}

  private projectScope(user: AuthUser, company?: CompanyKey): FilterQuery<ProjectDocument> {
    const filter: FilterQuery<ProjectDocument> = { deletedAt: null };
    if (user.role === Role.EMPLOYEE) filter.members = new Types.ObjectId(user.id);
    if (user.role === Role.SUPERVISOR) filter.company = user.company;
    else if (company) filter.company = company;
    return filter;
  }

  private employeeScope(user: AuthUser, company?: CompanyKey): FilterQuery<EmployeeDocument> {
    const filter: FilterQuery<EmployeeDocument> = { deletedAt: null };
    if (user.role !== Role.SUPER_ADMIN) filter.company = user.company;
    else if (company) filter.company = company;
    return filter;
  }

  private itemProgress(items: AnyRecord[] = []) {
    if (!items.length) return 0;
    return Math.round((items.filter((item) => item.done).length / items.length) * 100);
  }

  private subtaskProgress(subtask: AnyRecord) {
    if (!subtask.items?.length) return subtask.manualStatus === WorkStatus.COMPLETED ? 100 : subtask.manualStatus === WorkStatus.IN_PROGRESS ? 50 : 0;
    return this.itemProgress(subtask.items);
  }

  private taskProgress(task: AnyRecord) {
    if (!task.subtasks?.length) return task.manualStatus === WorkStatus.COMPLETED ? 100 : task.manualStatus === WorkStatus.IN_PROGRESS ? 50 : 0;
    return Math.round(task.subtasks.reduce((sum: number, subtask: AnyRecord) => sum + this.subtaskProgress(subtask), 0) / task.subtasks.length);
  }

  private projectProgress(project: AnyRecord) {
    if (!project.tasks?.length) return 0;
    return Math.round(project.tasks.reduce((sum: number, task: AnyRecord) => sum + this.taskProgress(task), 0) / project.tasks.length);
  }

  private startOfDay(date: Date) { const value = new Date(date); value.setHours(0, 0, 0, 0); return value; }
  private endOfDay(date: Date) { const value = new Date(date); value.setHours(23, 59, 59, 999); return value; }
  private dateKey(date: Date) { return date.toISOString().slice(0, 10); }
  private daysBetween(from: Date, to: Date) { return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86_400_000)); }

  async overview(user: AuthUser, company?: CompanyKey, requestedDays = 30) {
    const days = Math.min(365, Math.max(7, requestedDays));
    const now = new Date();
    const todayStart = this.startOfDay(now);
    const todayEnd = this.endOfDay(now);
    const periodStart = this.startOfDay(new Date(now.getTime() - (days - 1) * 86_400_000));

    const [projects, employees] = await Promise.all([
      this.projectModel.find(this.projectScope(user, company))
        .populate({ path: "members", select: "fullName company role status", match: { deletedAt: null } })
        .populate({ path: "deliveries.authorId", select: "fullName company role", match: { deletedAt: null } })
        .sort({ createdAt: -1 }).lean(),
      this.employeeModel.find(this.employeeScope(user, company)).select("fullName company role status createdAt updatedAt").lean()
    ]);

    const activeProjects = projects.filter((project) => project.status === ProjectStatus.ACTIVE);
    const projectRows = projects.map((project: AnyRecord) => {
      const tasks = project.tasks || [];
      const completedTasks = tasks.filter((task: AnyRecord) => this.taskProgress(task) === 100).length;
      return {
        id: String(project._id), name: project.name, company: project.company, client: project.client || "",
        dueDate: project.dueDate, status: project.status, progress: this.projectProgress(project),
        totalTasks: tasks.length, completedTasks
      };
    });

    const taskRows = projects.flatMap((project: AnyRecord) => (project.tasks || []).map((task: AnyRecord) => ({
      project, task, progress: this.taskProgress(task), dueDate: new Date(task.dueDate)
    })));
    const totalTasks = taskRows.length;
    const completedTasks = taskRows.filter((row) => row.progress === 100).length;
    const overdueTasks = taskRows.filter((row) => row.progress < 100 && row.dueDate < todayStart);
    const deliveries = projects.flatMap((project: AnyRecord) => (project.deliveries || []).map((delivery: AnyRecord) => ({ project, delivery })));
    const deliveriesToday = deliveries.filter(({ delivery }) => { const date = new Date(delivery.createdAt); return date >= todayStart && date <= todayEnd; });
    const periodDeliveries = deliveries.filter(({ delivery }) => new Date(delivery.createdAt) >= periodStart);
    const activeEmployees = employees.filter((employee) => employee.status === EmployeeStatus.ACTIVE).length;
    const onLeaveEmployees = employees.filter((employee) => employee.status === EmployeeStatus.ON_LEAVE).length;
    const newProjects = projects.filter((project: AnyRecord) => new Date(project.createdAt) >= periodStart).length;
    const incompleteTaskAges = taskRows.filter((row) => row.progress < 100).map((row) => this.daysBetween(new Date(row.project.createdAt), now));
    const averageTaskAgeDays = incompleteTaskAges.length ? Math.round((incompleteTaskAges.reduce((sum, value) => sum + value, 0) / incompleteTaskAges.length) * 10) / 10 : 0;

    const employeeNames = new Map(employees.map((employee: AnyRecord) => [String(employee._id), employee.fullName || "موظف"]));
    for (const project of projects as AnyRecord[]) for (const member of project.members || []) if (member?._id) employeeNames.set(String(member._id), member.fullName || "موظف");

    const attention = overdueTasks
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .slice(0, 8)
      .map(({ project, task, dueDate, progress }) => ({
        id: String(task._id), projectId: String(project._id), taskId: String(task._id), title: task.title,
        projectName: project.name, company: project.company, assignee: employeeNames.get(String(task.assigneeId)) || "غير محدد",
        dueDate, daysOverdue: this.daysBetween(dueDate, todayStart), progress, priority: task.priority
      }));

    const deliveryActivity = deliveries.map(({ project, delivery }) => {
      const authorId = typeof delivery.authorId === "object" ? String(delivery.authorId?._id || "") : String(delivery.authorId || "");
      const authorName = typeof delivery.authorId === "object" ? delivery.authorId?.fullName : employeeNames.get(authorId);
      const task = (project.tasks || []).find((entry: AnyRecord) => String(entry._id) === delivery.taskId);
      return {
        id: `delivery-${delivery._id}`, type: delivery.attachmentType === "video" ? "video" : delivery.attachmentType === "image" ? "image" : "delivery",
        user: authorName || "موظف", action: "أضاف تسليماً", subject: delivery.text || delivery.attachmentName || task?.title || project.name,
        createdAt: delivery.createdAt, projectId: String(project._id), taskId: delivery.taskId
      };
    });
    const projectActivity = (projects as AnyRecord[]).map((project) => ({
      id: `project-${project._id}`, type: "project", user: employeeNames.get(String(project.createdById)) || "فريق الإدارة",
      action: "أنشأ مشروعاً", subject: project.name, createdAt: project.createdAt, projectId: String(project._id)
    }));
    const activity = [...deliveryActivity, ...projectActivity]
      .filter((entry) => new Date(entry.createdAt) >= periodStart)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);

    const weekly = Array.from({ length: 7 }, (_, index) => {
      const date = this.startOfDay(new Date(now.getTime() - (6 - index) * 86_400_000));
      const key = this.dateKey(date);
      const added = taskRows.filter(({ project, task }) => this.dateKey(new Date(task.createdAt || project.createdAt)) === key).length;
      const done = taskRows.filter(({ project, task, progress }) => progress === 100 && this.dateKey(new Date(task.updatedAt || project.updatedAt)) === key).length;
      return { date: key, added, done };
    });

    const companyRows = ([CompanyKey.SPARK, CompanyKey.PRO] as CompanyKey[])
      .filter((key) => !company || key === company)
      .filter((key) => user.role === Role.SUPER_ADMIN || user.company === key)
      .map((key) => {
        const scopedProjects = projectRows.filter((project) => project.company === key);
        const scopedTasks = taskRows.filter((row) => row.project.company === key);
        const scopedEmployees = employees.filter((employee) => employee.company === key);
        const scopedDeliveries = periodDeliveries.filter(({ project }) => project.company === key);
        const completionRate = scopedTasks.length ? Math.round((scopedTasks.filter((row) => row.progress === 100).length / scopedTasks.length) * 100) : 0;
        const trend = weekly.map((day) => ({ date: day.date, value: deliveries.filter(({ project, delivery }) => project.company === key && this.dateKey(new Date(delivery.createdAt)) === day.date).length + scopedTasks.filter((row) => row.progress === 100 && this.dateKey(new Date(row.task.updatedAt || row.project.updatedAt)) === day.date).length }));
        return {
          key, activeProjects: scopedProjects.filter((project) => project.status === ProjectStatus.ACTIVE).length,
          projects: scopedProjects.length, employees: scopedEmployees.length,
          activeEmployees: scopedEmployees.filter((employee) => employee.status === EmployeeStatus.ACTIVE).length,
          totalTasks: scopedTasks.length, completedTasks: scopedTasks.filter((row) => row.progress === 100).length,
          overdueTasks: scopedTasks.filter((row) => row.progress < 100 && row.dueDate < todayStart).length,
          deliveries: scopedDeliveries.length, completionRate, trend
        };
      });

    return {
      generatedAt: now,
      period: { days, from: periodStart, to: now },
      summary: {
        activeProjects: activeProjects.length, newProjects, overdueTasks: overdueTasks.length,
        deliveriesToday: deliveriesToday.length, periodDeliveries: periodDeliveries.length,
        activeEmployees, totalEmployees: employees.length, onLeaveEmployees,
        completionRate: totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0,
        completedTasks, totalTasks, averageTaskAgeDays
      },
      companies: companyRows,
      projects: projectRows.sort((a, b) => b.progress - a.progress),
      attention, activity, weekly
    };
  }
}
