import { deriveTaskWorkStatus, employeeChecklistUpdateIssue, taskReceiptIssue } from "./checklist-rules";

describe("ProjectsService checklist rules", () => {
  const employeeId = "employee-1";

  function nodes(
    taskStatus = "IN_PROGRESS",
    detailStatus = "IN_PROGRESS",
    startedById = employeeId,
    startedAt: Date | null = new Date("2026-11-08T08:00:00.000Z"),
  ) {
    const subtask = {
      manualStatus: detailStatus,
      startedAt,
      startedById: startedById || null,
      items: [{ done: false }],
      elapsedSeconds: 0,
    };
    const task = {
      manualStatus: taskStatus,
      assigneeId: employeeId,
      helperIds: [],
      subtasks: [subtask],
    };
    return { task, subtask };
  }

  it("allows the employee who is actively running both the task and its detail", () => {
    const { task, subtask } = nodes();
    expect(employeeChecklistUpdateIssue({ taskStatus: task.manualStatus as any, detailStatus: subtask.manualStatus as any, employeeId, startedAt: subtask.startedAt, startedById: subtask.startedById })).toBeNull();
  });

  it.each([
    ["PAUSED", "IN_PROGRESS"],
    ["IN_PROGRESS", "PAUSED"],
    ["NOT_STARTED", "NOT_STARTED"],
  ])("rejects checklist updates unless both levels are running (%s / %s)", (taskStatus, detailStatus) => {
    const { task, subtask } = nodes(taskStatus, detailStatus);
    expect(employeeChecklistUpdateIssue({ taskStatus: task.manualStatus as any, detailStatus: subtask.manualStatus as any, employeeId, startedAt: subtask.startedAt, startedById: subtask.startedById })).toBe("NOT_RUNNING");
  });

  it("rejects checklist updates when the detail has no active timer", () => {
    const { task, subtask } = nodes("IN_PROGRESS", "IN_PROGRESS", employeeId, null);
    expect(employeeChecklistUpdateIssue({ taskStatus: task.manualStatus as any, detailStatus: subtask.manualStatus as any, employeeId, startedAt: subtask.startedAt, startedById: subtask.startedById })).toBe("NOT_RUNNING");
  });

  it("rejects an employee when another employee owns the running detail", () => {
    const { task, subtask } = nodes("IN_PROGRESS", "IN_PROGRESS", "employee-2");
    expect(employeeChecklistUpdateIssue({ taskStatus: task.manualStatus as any, detailStatus: subtask.manualStatus as any, employeeId, startedAt: subtask.startedAt, startedById: subtask.startedById })).toBe("NOT_OWNER");
  });

  it("synchronizes the parent task with the running and paused detail states", () => {
    const { task, subtask } = nodes("NOT_STARTED", "IN_PROGRESS");
    task.manualStatus = deriveTaskWorkStatus(task.subtasks, (detail) => detail.items.some((item: any) => item.done) ? 100 : 0) || task.manualStatus;
    expect(task.manualStatus).toBe("IN_PROGRESS");

    subtask.manualStatus = "PAUSED";
    subtask.elapsedSeconds = 30;
    task.manualStatus = deriveTaskWorkStatus(task.subtasks, (detail) => detail.items.some((item: any) => item.done) ? 100 : 0) || task.manualStatus;
    expect(task.manualStatus).toBe("PAUSED");
  });

  it("requires receipt when another user created a task assigned to the employee", () => {
    expect(taskReceiptIssue({
      employeeId,
      creatorId: "supervisor-1",
      assigneeId: employeeId,
      helperIds: [],
    })).toBeNull();
  });

  it("does not allow a user to receive a task they created", () => {
    expect(taskReceiptIssue({
      employeeId,
      creatorId: employeeId,
      assigneeId: employeeId,
      helperIds: [],
    })).toBe("SELF_CREATED");
  });

  it("does not allow an unrelated user to receive the task", () => {
    expect(taskReceiptIssue({
      employeeId,
      creatorId: "supervisor-1",
      assigneeId: "employee-2",
      helperIds: ["employee-3"],
    })).toBe("NOT_ASSIGNED");
  });

  it("keeps legacy tasks without creator data receivable by their assignee", () => {
    expect(taskReceiptIssue({ employeeId, assigneeId: employeeId })).toBeNull();
  });
});
