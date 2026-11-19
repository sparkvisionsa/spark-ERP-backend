import { jest } from "@jest/globals";
import { Types } from "mongoose";
import { Role } from "../common/enums/role.enum";
import { NotificationsService } from "./notifications.service";
import { NotificationType } from "./schemas/notification.schema";

describe("NotificationsService", () => {
  const actorId = new Types.ObjectId().toString();
  const recipientId = new Types.ObjectId().toString();
  const input = {
    type: NotificationType.TASK_ASSIGNED,
    title: "مهمة جديدة",
    message: "تم تعيين مهمة جديدة",
    eventKey: "task-assigned:test",
  };

  it("deduplicates recipients and does not notify the actor about their own action", async () => {
    const insertMany = jest.fn(async () => []);
    const service = new NotificationsService({ insertMany } as never, {} as never);

    await service.notifyUsers([actorId, recipientId, recipientId], input, actorId);

    expect(insertMany).toHaveBeenCalledTimes(1);
    const [documents, options] = insertMany.mock.calls[0] as any;
    expect(documents).toHaveLength(1);
    expect(String(documents[0].recipientId)).toBe(recipientId);
    expect(options).toEqual({ ordered: false });
  });

  it("targets every active system administrator", async () => {
    const adminIds = [new Types.ObjectId(), new Types.ObjectId()];
    let insertedDocuments: any[] = [];
    const insertMany = jest.fn(async (documents: any[]) => {
      insertedDocuments = documents;
      return [];
    });
    const lean = jest.fn(async () => adminIds.map((_id) => ({ _id })));
    const select = jest.fn(() => ({ lean }));
    const find = jest.fn(() => ({ select }));
    const service = new NotificationsService({ insertMany } as never, { find } as never);

    await service.notifyRole(Role.SUPER_ADMIN, {
      ...input,
      type: NotificationType.ATTENDANCE_CHECK_IN,
      eventKey: "attendance:test",
    });

    expect(find).toHaveBeenCalledWith(expect.objectContaining({ role: Role.SUPER_ADMIN, deletedAt: null }));
    expect(insertMany).toHaveBeenCalledTimes(1);
    expect(insertedDocuments).toHaveLength(2);
  });

  it("marks assignment and checklist notifications as read and acknowledged when the recipient receives the task", async () => {
    const updateMany = jest.fn(async () => ({ modifiedCount: 1 }));
    const service = new NotificationsService({ updateMany } as never, {} as never);

    await service.markTaskNotificationsRead(recipientId, "task-1");

    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        taskId: "task-1",
        type: { $in: [NotificationType.TASK_ASSIGNED, NotificationType.CHECKLIST_ITEM_ADDED] },
        readAt: null,
      }),
      { $set: { readAt: expect.any(Date), acknowledgedAt: expect.any(Date) } },
    );
  });

  it("returns pending important alerts (unread and not dismissed) oldest first", async () => {
    const queries: any[] = [];
    const chain = (result: unknown) => {
      const query: any = {};
      query.sort = jest.fn((sort: unknown) => { query.sortArg = sort; return query; });
      query.limit = jest.fn(() => query);
      query.populate = jest.fn(() => query);
      query.lean = jest.fn(async () => result);
      return query;
    };
    const find = jest.fn((filter: unknown) => {
      const query = chain([]);
      query.filter = filter;
      queries.push(query);
      return query;
    });
    const countDocuments = jest.fn(async () => 0);
    const service = new NotificationsService({ find, countDocuments } as never, {} as never);

    const result = await service.list(recipientId);

    expect(result).toHaveProperty("popups");
    const popupQuery = queries.find((query) => query.filter.acknowledgedAt === null);
    expect(popupQuery.filter).toEqual(expect.objectContaining({
      readAt: null,
      acknowledgedAt: null,
      type: { $in: [NotificationType.TASK_ASSIGNED, NotificationType.CHECKLIST_ITEM_ADDED, NotificationType.DELIVERY_CREATED, NotificationType.DELIVERY_REPLY] },
    }));
    expect(popupQuery.sortArg).toEqual({ createdAt: 1 });
  });

  it("acknowledges a popup without marking the notification as read", async () => {
    const findOneAndUpdate = jest.fn(async () => ({ _id: "n1" }));
    const service = new NotificationsService({ findOneAndUpdate } as never, {} as never);
    const notificationId = new Types.ObjectId().toString();

    await service.acknowledge(notificationId, recipientId);

    const [, update] = findOneAndUpdate.mock.calls[0] as any;
    expect(update).toEqual({ $set: { acknowledgedAt: expect.any(Date) } });
    expect(update.$set).not.toHaveProperty("readAt");
  });
});
