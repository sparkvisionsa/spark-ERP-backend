export type ChecklistWorkStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";

export type ChecklistUpdateIssue = "NOT_RUNNING" | "NOT_OWNER" | null;

export function bypassesChecklistSessionRestrictions(role: string) {
  return role === "SUPER_ADMIN";
}

export function employeeChecklistUpdateIssue(input: {
  taskStatus: ChecklistWorkStatus;
  detailStatus: ChecklistWorkStatus;
  employeeId: string;
  startedAt?: unknown;
  startedById?: unknown;
}): ChecklistUpdateIssue {
  if (
    input.taskStatus !== "IN_PROGRESS" ||
    input.detailStatus !== "IN_PROGRESS" ||
    !input.startedAt
  ) return "NOT_RUNNING";
  if (!input.startedById || String(input.startedById) !== input.employeeId) return "NOT_OWNER";
  return null;
}

export function deriveTaskWorkStatus(
  subtasks: any[],
  progressFor: (subtask: any) => number,
): ChecklistWorkStatus | null {
  if (!subtasks.length) return null;
  if (subtasks.some((subtask) => subtask.manualStatus === "IN_PROGRESS")) return "IN_PROGRESS";
  if (subtasks.every((subtask) => subtask.manualStatus === "COMPLETED" || progressFor(subtask) >= 100)) return "COMPLETED";
  const hasStarted = subtasks.some((subtask) =>
    subtask.manualStatus === "PAUSED" ||
    subtask.manualStatus === "COMPLETED" ||
    Boolean(subtask.firstStartedAt) ||
    Number(subtask.elapsedSeconds || 0) > 0 ||
    progressFor(subtask) > 0,
  );
  return hasStarted ? "PAUSED" : "NOT_STARTED";
}

export type TaskReceiptIssue = "NOT_ASSIGNED" | "SELF_CREATED" | null;

export function taskReceiptIssue(input: {
  employeeId: string;
  creatorId?: unknown;
  assigneeId?: unknown;
  helperIds?: unknown[];
}): TaskReceiptIssue {
  const assigned = String(input.assigneeId || "") === input.employeeId ||
    (input.helperIds || []).some((id) => String(id) === input.employeeId);
  if (!assigned) return "NOT_ASSIGNED";
  if (input.creatorId && String(input.creatorId) === input.employeeId) return "SELF_CREATED";
  return null;
}
