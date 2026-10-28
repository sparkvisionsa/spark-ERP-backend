import { AnalyticsService } from "./analytics.service";
import { WorkStatus } from "../projects/schemas/project.schema";

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
});
