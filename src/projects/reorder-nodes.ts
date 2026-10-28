import { BadRequestException, NotFoundException } from "@nestjs/common";

export function reorderNodes(
  nodes: any[],
  id: string,
  direction?: "up" | "down",
  targetId?: string,
) {
  const ordered = [...nodes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const index = ordered.findIndex((node) => String(node._id) === id);
  if (index < 0) throw new NotFoundException("العنصر غير موجود");

  if (targetId) {
    if (targetId === id) return false;
    const moved = ordered.splice(index, 1)[0];
    const target = ordered.findIndex((node) => String(node._id) === targetId);
    if (target < 0) throw new NotFoundException("موضع الإفلات غير موجود");
    ordered.splice(target, 0, moved);
  } else {
    if (!direction) throw new BadRequestException("حدد موضعاً جديداً للعنصر");
    const target = index + (direction === "up" ? -1 : 1);
    if (target < 0 || target >= ordered.length) return false;
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
  }

  ordered.forEach((node, order) => {
    node.order = order;
  });
  return true;
}
