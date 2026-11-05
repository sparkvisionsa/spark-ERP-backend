import { AnalyticsService } from "./analytics.service";
import { ProjectStatus, WorkStatus } from "../projects/schemas/project.schema";

describe("AnalyticsService progress calculations", () => {
  const service = new AnalyticsService({} as never, {} as never, {} as never) as any;

  it("calculates checklist completion percentage", () => {
    expect(service.itemProgress([{ done: true }, { done: false }, { done: true }])).toBe(67);
  });

  it("uses manual status when a subtask has no checklist", () => {
    expect(service.subtaskProgress({ items: [], manualStatus: WorkStatus.IN_PROGRESS })).toBe(50);
    expect(service.subtaskProgress({ items: [], manualStatus: WorkStatus.COMPLETED })).toBe(100);
  });

  it("averages subtasks into task progress", () => {
    const task = { subtasks: [{ items: [{ done: true }] }, { items: [{ done: false }] }] };
    expect(service.taskProgress(task)).toBe(50);
  });

  it("averages tasks into project progress", () => {
    const project = { tasks: [{ subtasks: [{ items: [{ done: true }] }] }, { subtasks: [{ items: [{ done: false }] }] }] };
    expect(service.projectProgress(project)).toBe(50);
  });

  it("returns zero for an empty project", () => {
    expect(service.projectProgress({ tasks: [] })).toBe(0);
  });

  it("counts only projects where work actually started as in progress", () => {
    const notStarted = {
      status: ProjectStatus.ACTIVE,
      tasks: [{ manualStatus: WorkStatus.NOT_STARTED, subtasks: [] }],
    };
    const started = {
      status: ProjectStatus.ACTIVE,
      tasks: [{ manualStatus: WorkStatus.IN_PROGRESS, subtasks: [] }],
    };
    expect(service.isProjectInProgress(notStarted)).toBe(false);
    expect(service.isProjectInProgress(started)).toBe(true);
  });

  it("never counts completed or archived projects as in progress", () => {
    const startedTask = { manualStatus: WorkStatus.IN_PROGRESS, subtasks: [] };
    expect(service.isProjectInProgress({ status: ProjectStatus.COMPLETED, tasks: [startedTask] })).toBe(false);
    expect(service.isProjectInProgress({ status: ProjectStatus.ARCHIVED, tasks: [startedTask] })).toBe(false);
  });

  it("treats paused timed work as started", () => {
    const project = {
      status: ProjectStatus.ACTIVE,
      tasks: [{
        manualStatus: WorkStatus.NOT_STARTED,
        subtasks: [{ manualStatus: WorkStatus.PAUSED, elapsedSeconds: 120, items: [] }],
      }],
    };
    expect(service.isProjectInProgress(project)).toBe(true);
  });

  it("excludes overdue tasks that belong to archived projects", () => {
    const today = new Date("2026-11-05T00:00:00.000Z");
    const overdueDate = new Date("2026-11-01T00:00:00.000Z");
    const activeRow = {
      project: { status: ProjectStatus.ACTIVE },
      progress: 50,
      dueDate: overdueDate,
    };
    const archivedRow = {
      project: { status: ProjectStatus.ARCHIVED },
      progress: 50,
      dueDate: overdueDate,
    };
    expect(service.isOverdueProjectTask(activeRow, today)).toBe(true);
    expect(service.isOverdueProjectTask(archivedRow, today)).toBe(false);
  });
});
