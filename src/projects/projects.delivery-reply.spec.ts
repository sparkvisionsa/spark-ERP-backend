import { deliveryReplyCandidates, deliveryReplyExcerpt } from "./delivery-reply";

describe("delivery reply alerts", () => {
  const subtaskId = "subtask-1";
  const replyId = "reply-1";

  it("targets the task team and earlier participants of the same item, without the replier", () => {
    const task = { assigneeId: "assignee", helperIds: ["helper", "admin"] };
    const deliveries = [
      { _id: "d1", authorId: "supervisor", subtaskId },
      { _id: "d2", authorId: "assignee", subtaskId },
      { _id: "d3", authorId: "other-item-author", subtaskId: "subtask-2" },
      { _id: replyId, authorId: "admin", subtaskId },
    ];

    const recipients = deliveryReplyCandidates(task, deliveries, subtaskId, replyId, "admin");

    expect(new Set(recipients)).toEqual(new Set(["assignee", "helper", "supervisor"]));
    expect(recipients).toHaveLength(3);
  });

  it("returns nobody when the replier is the only participant", () => {
    const task = { assigneeId: "assignee", helperIds: [] };
    const deliveries = [{ _id: replyId, authorId: "assignee", subtaskId }];

    expect(deliveryReplyCandidates(task, deliveries, subtaskId, replyId, "assignee")).toEqual([]);
  });

  it("builds a short single-line excerpt of the reply", () => {
    expect(deliveryReplyExcerpt("  راجع \n  الشعار  ")).toBe("راجع الشعار");
    expect(deliveryReplyExcerpt("")).toBe("");
    expect(deliveryReplyExcerpt("a".repeat(150), 10)).toBe(`${"a".repeat(10)}…`);
  });
});
