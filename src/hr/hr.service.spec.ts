import { BadRequestException } from "@nestjs/common";
import { jest } from "@jest/globals";
import { Types } from "mongoose";
import { HrService } from "./hr.service";
import { WorkPauseReason, WorkStatus } from "../projects/schemas/project.schema";

describe("HrService validation", () => {
  const service = new HrService({} as never, {} as never, {} as never, {} as never);

  it("rejects a leave ending before its start", async () => {
    await expect(service.addLeave("507f1f77bcf86cd799439011", { type: "سنوية", startDate: "2026-10-10", endDate: "2026-10-09" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unknown record collection before touching storage", async () => {
    await expect(service.remove("507f1f77bcf86cd799439011", "unknown" as never, "507f1f77bcf86cd799439012")).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows checkout at any time after the shift starts", () => {
    const checkedInAt = new Date("2026-11-07T05:00:00.000Z");
    const record = {
      attendance: [{
        checkedInAt,
        checkoutAvailableAt: new Date(checkedInAt.getTime() + 10 * 60 * 60 * 1000),
        checkedOutAt: null,
        status: "WORKING",
        checkIn: "08:00",
      }],
    };

    const before = (service as any).statusPayload(record, new Date("2026-11-07T05:01:00.000Z"));
    const ready = (service as any).statusPayload(record, new Date("2026-11-07T14:00:00.000Z"));

    expect(before.state).toBe("WORKING");
    expect(before.canCheckOut).toBe(true);
    expect(ready.state).toBe("CHECKOUT_AVAILABLE");
    expect(ready.canCheckOut).toBe(true);
  });

  it("treats the 15 minutes before and after attendance times as on time", () => {
    const startAt = new Date("2026-11-07T05:00:00.000Z");
    const endAt = new Date("2026-11-07T14:00:00.000Z");

    expect((service as any).checkInTiming(new Date("2026-11-07T04:44:59.000Z"), startAt, endAt)).toBe("EARLY");
    expect((service as any).checkInTiming(new Date("2026-11-07T04:45:00.000Z"), startAt, endAt)).toBe("ON_TIME");
    expect((service as any).checkInTiming(new Date("2026-11-07T05:15:00.000Z"), startAt, endAt)).toBe("ON_TIME");
    expect((service as any).checkInTiming(new Date("2026-11-07T05:15:01.000Z"), startAt, endAt)).toBe("LATE");

    expect((service as any).checkOutTiming(new Date("2026-11-07T13:44:59.000Z"), endAt)).toBe("EARLY");
    expect((service as any).checkOutTiming(new Date("2026-11-07T13:45:00.000Z"), endAt)).toBe("ON_TIME");
    expect((service as any).checkOutTiming(new Date("2026-11-07T14:15:00.000Z"), endAt)).toBe("ON_TIME");
    expect((service as any).checkOutTiming(new Date("2026-11-07T14:15:01.000Z"), endAt)).toBe("OVERTIME");
  });

  it("uses the official end time even when the employee checks in late", () => {
    const record = {
      attendance: [{
        dateKey: "2026-11-07",
        checkedInAt: new Date("2026-11-07T06:00:00.000Z"),
        checkoutAvailableAt: new Date("2026-11-07T16:00:00.000Z"),
        officialEndAt: new Date("2026-11-07T15:00:00.000Z"),
        checkedOutAt: null,
        status: "WORKING",
        checkIn: "09:00",
      }],
    };

    const ready = (service as any).statusPayload(record, new Date("2026-11-07T14:00:00.000Z"));

    expect(ready.state).toBe("CHECKOUT_AVAILABLE");
    expect(ready.checkoutAvailableAt.toISOString()).toBe("2026-11-07T06:00:00.000Z");
    expect(ready.minimumShiftSeconds).toBe(9 * 60 * 60);
    expect(ready.checkInStatus).toBe("LATE");
  });

  it("reports an active break without disabling checkout", () => {
    const record = {
      attendance: [{
        dateKey: "2026-11-07",
        checkedInAt: new Date("2026-11-07T05:00:00.000Z"),
        checkedOutAt: null,
        status: "WORKING",
        checkIn: "08:00",
        breaks: [{ startedAt: new Date("2026-11-07T10:00:00.000Z"), endedAt: null }],
      }],
    };

    const status = (service as any).statusPayload(record, new Date("2026-11-07T10:05:00.000Z"));

    expect(status.activeBreak.startedAt).toEqual(new Date("2026-11-07T10:00:00.000Z"));
    expect(status.breakSeconds).toBe(5 * 60);
    expect(status.canCheckOut).toBe(true);
  });

  it("calculates overtime only after the 17:15 Riyadh grace-period end", () => {
    const record = {
      attendance: [{
        dateKey: "2026-11-07",
        checkedInAt: new Date("2026-11-07T05:00:00.000Z"),
        checkedOutAt: new Date("2026-11-07T14:16:00.000Z"),
        status: "COMPLETED",
        checkIn: "08:00",
        checkOut: "17:16",
        checkOutStatus: "OVERTIME",
        breaks: [{ startedAt: new Date("2026-11-07T09:00:00.000Z"), endedAt: new Date("2026-11-07T09:10:00.000Z") }],
      }],
    };

    const status = (service as any).statusPayload(record, new Date("2026-11-07T14:20:00.000Z"));

    expect(status.state).toBe("COMPLETED");
    expect(status.checkOutStatus).toBe("OVERTIME");
    expect(status.overtimeSeconds).toBe(60);
    expect(status.breakSeconds).toBe(10 * 60);
  });

  it("pauses the employee's running detail when checking out", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-11-07T14:00:00.000Z"));
    const employeeId = new Types.ObjectId().toString();
    const subtask = {
      _id: new Types.ObjectId(), title: "التصميم التفصيلي", manualStatus: WorkStatus.IN_PROGRESS,
      startedAt: new Date("2026-11-07T13:30:00.000Z"), startedById: new Types.ObjectId(employeeId),
      elapsedSeconds: 60,
    };
    let saveCalls = 0;
    const project = {
      _id: new Types.ObjectId(), name: "مشروع اختبار",
      tasks: [{ _id: new Types.ObjectId(), title: "المهمة", assigneeId: new Types.ObjectId(employeeId), manualStatus: WorkStatus.IN_PROGRESS, subtasks: [subtask] }],
      save: async () => { saveCalls += 1; },
    };
    const projectModel = { find: async () => [project] };
    const attendance = new HrService({} as never, {} as never, projectModel as never, {} as never);

    const paused = await (attendance as any).pauseActiveWork(employeeId);

    expect(paused.subtaskTitle).toBe("التصميم التفصيلي");
    expect(paused.pausedAutomatically).toBe(true);
    expect(subtask.manualStatus).toBe(WorkStatus.PAUSED);
    expect((subtask as any).pauseReason).toBe(WorkPauseReason.ATTENDANCE_CHECKOUT);
    expect(subtask.elapsedSeconds).toBe(1860);
    expect(project.tasks[0].manualStatus).toBe(WorkStatus.PAUSED);
    expect(saveCalls).toBe(1);
    jest.useRealTimers();
  });

  it("resumes the latest paused detail when the next shift starts", async () => {
    const employeeId = new Types.ObjectId().toString();
    const subtask = {
      _id: new Types.ObjectId(), title: "المراجعة النهائية", manualStatus: WorkStatus.PAUSED,
      pausedAt: new Date("2026-11-06T15:00:00.000Z"), lastWorkedById: new Types.ObjectId(employeeId),
      startedAt: null, startedById: null, firstStartedAt: new Date("2026-11-06T10:00:00.000Z"),
    };
    let saveCalls = 0;
    const project = {
      _id: new Types.ObjectId(), name: "مشروع اختبار",
      tasks: [{ _id: new Types.ObjectId(), title: "المهمة", assigneeId: new Types.ObjectId(employeeId), manualStatus: WorkStatus.PAUSED, subtasks: [subtask] }],
      save: async () => { saveCalls += 1; },
    };
    let findCalls = 0;
    const projectModel = { find: async () => findCalls++ === 0 ? [] : [project] };
    const attendance = new HrService({} as never, {} as never, projectModel as never, {} as never);
    const record = { attendance: [] };

    const resumed = await (attendance as any).resumePausedWork(employeeId, record);

    expect(resumed.subtaskTitle).toBe("المراجعة النهائية");
    expect(subtask.manualStatus).toBe(WorkStatus.IN_PROGRESS);
    expect(subtask.startedAt).toBeInstanceOf(Date);
    expect(String(subtask.startedById)).toBe(employeeId);
    expect(project.tasks[0].manualStatus).toBe(WorkStatus.IN_PROGRESS);
    expect(saveCalls).toBe(1);
  });
});
