import { Injectable, NotFoundException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { EmployeeStatus, Role } from "../common/enums/role.enum";
import { Notification, NotificationDocument, NotificationType } from "./schemas/notification.schema";

/** Notification types that open the persistent important-alert popup until acted on. */
export const POPUP_NOTIFICATION_TYPES = [
  NotificationType.TASK_ASSIGNED,
  NotificationType.CHECKLIST_ITEM_ADDED,
  NotificationType.DELIVERY_CREATED,
  NotificationType.DELIVERY_REPLY,
];

export type CreateNotificationInput = {
  type: NotificationType;
  title: string;
  message: string;
  href?: string;
  actorId?: string;
  projectId?: string;
  taskId?: string;
  subtaskId?: string;
  eventKey: string;
};

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(Notification.name) private readonly notificationModel: Model<NotificationDocument>,
    @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>,
  ) {}

  async notifyUsers(recipientIds: string[], input: CreateNotificationInput, excludeRecipientId?: string) {
    const recipients = [...new Set(recipientIds)]
      .filter((id) => id !== excludeRecipientId && Types.ObjectId.isValid(id));
    if (!recipients.length) return;
    const documents = recipients.map((recipientId) => ({
      recipientId: new Types.ObjectId(recipientId),
      actorId: input.actorId && Types.ObjectId.isValid(input.actorId)
        ? new Types.ObjectId(input.actorId)
        : null,
      type: input.type,
      title: input.title,
      message: input.message,
      href: input.href || "",
      projectId: input.projectId || "",
      taskId: input.taskId || "",
      subtaskId: input.subtaskId || "",
      eventKey: input.eventKey,
    }));
    try {
      await this.notificationModel.insertMany(documents, { ordered: false });
    } catch (error: any) {
      // Duplicate event keys are intentionally ignored so retries never create noise.
      if (error?.code !== 11000 && !error?.writeErrors?.every((entry: any) => entry?.code === 11000)) throw error;
    }
  }

  async notifyRole(role: Role, input: CreateNotificationInput, excludeRecipientId?: string) {
    const recipients = await this.employeeModel
      .find({ role, status: EmployeeStatus.ACTIVE, deletedAt: null })
      .select("_id")
      .lean();
    await this.notifyUsers(recipients.map((recipient) => String(recipient._id)), input, excludeRecipientId);
  }

  async list(recipientId: string, requestedLimit?: number) {
    const limit = Math.min(50, Math.max(10, Number(requestedLimit) || 30));
    const filter = { recipientId: new Types.ObjectId(recipientId) };
    const [items, unreadCount, popups] = await Promise.all([
      this.notificationModel
        .find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate({ path: "actorId", select: "fullName role" })
        .lean(),
      this.notificationModel.countDocuments({ ...filter, readAt: null }),
      // Important alerts stay pending (across reloads and pages) until the
      // recipient opens them or explicitly dismisses the popup.
      this.notificationModel
        .find({ ...filter, readAt: null, acknowledgedAt: null, type: { $in: POPUP_NOTIFICATION_TYPES } })
        .sort({ createdAt: 1 })
        .limit(20)
        .populate({ path: "actorId", select: "fullName role" })
        .lean(),
    ]);
    return { items, unreadCount, popups };
  }

  async markRead(notificationId: string, recipientId: string) {
    if (!Types.ObjectId.isValid(notificationId)) throw new NotFoundException("الإشعار غير موجود");
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, recipientId: new Types.ObjectId(recipientId) },
      { $set: { readAt: new Date(), acknowledgedAt: new Date() } },
      { new: true },
    );
    if (!notification) throw new NotFoundException("الإشعار غير موجود");
    return { success: true };
  }

  async acknowledge(notificationId: string, recipientId: string) {
    if (!Types.ObjectId.isValid(notificationId)) throw new NotFoundException("الإشعار غير موجود");
    const notification = await this.notificationModel.findOneAndUpdate(
      { _id: notificationId, recipientId: new Types.ObjectId(recipientId) },
      { $set: { acknowledgedAt: new Date() } },
      { new: true },
    );
    if (!notification) throw new NotFoundException("الإشعار غير موجود");
    return { success: true };
  }

  async acknowledgeAll(recipientId: string) {
    await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(recipientId), acknowledgedAt: null },
      { $set: { acknowledgedAt: new Date() } },
    );
    return { success: true };
  }

  async markAllRead(recipientId: string) {
    await this.notificationModel.updateMany(
      { recipientId: new Types.ObjectId(recipientId), readAt: null },
      { $set: { readAt: new Date(), acknowledgedAt: new Date() } },
    );
    return { success: true };
  }

  async markTaskNotificationsRead(recipientId: string, taskId: string) {
    await this.notificationModel.updateMany(
      {
        recipientId: new Types.ObjectId(recipientId),
        taskId,
        type: { $in: [NotificationType.TASK_ASSIGNED, NotificationType.CHECKLIST_ITEM_ADDED] },
        readAt: null,
      },
      { $set: { readAt: new Date(), acknowledgedAt: new Date() } },
    );
  }
}
