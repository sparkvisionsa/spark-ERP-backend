/**
 * Pure helpers for "reply in deliveries" alerts. A delivery added to a checklist
 * item's thread is a reply for everyone already involved in it.
 */

type IdLike = { toString(): string } | string | null | undefined;

export type DeliveryReplyTask = { assigneeId?: IdLike; helperIds?: IdLike[] };
export type DeliveryReplyEntry = { _id?: IdLike; authorId?: IdLike; subtaskId?: IdLike };

/** Task assignee + helpers + earlier authors on the same item, without the replier, de-duplicated. */
export function deliveryReplyCandidates(
  task: DeliveryReplyTask,
  deliveries: DeliveryReplyEntry[],
  subtaskId: string,
  replyId: string,
  actorId: string,
) {
  const earlierAuthors = deliveries
    .filter((entry) => String(entry._id) !== replyId && String(entry.subtaskId) === subtaskId)
    .map((entry) => String(entry.authorId ?? ""));
  return [...new Set([
    String(task.assigneeId ?? ""),
    ...(task.helperIds || []).map((id) => String(id ?? "")),
    ...earlierAuthors,
  ])].filter((id) => id && id !== "null" && id !== "undefined" && id !== actorId);
}

/** A short single-line preview of the reply text for the alert message. */
export function deliveryReplyExcerpt(text?: string | null, limit = 140) {
  const clean = String(text || "").replace(/\s+/g, " ").trim();
  return clean.length > limit ? `${clean.slice(0, limit)}…` : clean;
}
