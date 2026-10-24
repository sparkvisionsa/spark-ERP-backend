import { EmployeesService } from "./employees.service";

describe("EmployeesService", () => {
  describe("normalizePhone", () => {
    it.each([
      ["0555765446", "+966555765446"],
      ["555765446", "+966555765446"],
      ["966555765446", "+966555765446"],
      ["+966555765446", "+966555765446"]
    ])("normalizes %s", (input, expected) => expect(EmployeesService.normalizePhone(input)).toBe(expected));
  });
});
