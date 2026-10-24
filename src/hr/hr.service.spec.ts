import { BadRequestException } from "@nestjs/common";
import { HrService } from "./hr.service";

describe("HrService validation", () => {
  const service = new HrService({} as never, {} as never);

  it("rejects a leave ending before its start", async () => {
    await expect(service.addLeave("507f1f77bcf86cd799439011", { type: "سنوية", startDate: "2026-10-10", endDate: "2026-10-09" })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("rejects an unknown record collection before touching storage", async () => {
    await expect(service.remove("507f1f77bcf86cd799439011", "unknown" as never, "507f1f77bcf86cd799439012")).rejects.toBeInstanceOf(BadRequestException);
  });
});
