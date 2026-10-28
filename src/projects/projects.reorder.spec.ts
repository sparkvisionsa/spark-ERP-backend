import { BadRequestException, NotFoundException } from "@nestjs/common";
import { reorderNodes } from "./reorder-nodes";

const orderedIds = (nodes: Array<{ _id: string; order: number }>) =>
  [...nodes].sort((a, b) => a.order - b.order).map((node) => node._id);

describe("reorderNodes", () => {
  it("moves a stage before the drop target and normalizes every order", () => {
    const nodes = [
      { _id: "first", order: 0 },
      { _id: "second", order: 5 },
      { _id: "third", order: 9 },
    ];

    expect(reorderNodes(nodes, "third", undefined, "first")).toBe(true);
    expect(orderedIds(nodes)).toEqual(["third", "first", "second"]);
    expect(nodes.map((node) => node.order).sort()).toEqual([0, 1, 2]);
  });

  it("supports keyboard-style up and down movement", () => {
    const nodes = [
      { _id: "first", order: 0 },
      { _id: "second", order: 1 },
      { _id: "third", order: 2 },
    ];

    expect(reorderNodes(nodes, "second", "down")).toBe(true);
    expect(orderedIds(nodes)).toEqual(["first", "third", "second"]);
  });

  it("treats dropping on itself or moving past an edge as a no-op", () => {
    const nodes = [
      { _id: "first", order: 0 },
      { _id: "second", order: 1 },
    ];

    expect(reorderNodes(nodes, "first", undefined, "first")).toBe(false);
    expect(reorderNodes(nodes, "first", "up")).toBe(false);
    expect(orderedIds(nodes)).toEqual(["first", "second"]);
  });

  it("rejects missing sources, targets, and positions", () => {
    const nodes = [{ _id: "first", order: 0 }];

    expect(() => reorderNodes(nodes, "missing", "down")).toThrow(NotFoundException);
    expect(() => reorderNodes(nodes, "first", undefined, "missing")).toThrow(NotFoundException);
    expect(() => reorderNodes(nodes, "first")).toThrow(BadRequestException);
  });
});
