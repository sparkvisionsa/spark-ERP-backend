export enum Role {
  SUPER_ADMIN = "SUPER_ADMIN",
  SUPERVISOR = "SUPERVISOR",
  EMPLOYEE = "EMPLOYEE"
}

export type CompanyKey = string;
export const CompanyKey = { SPARK: "spark", PRO: "pro" } as const;

export enum EmployeeStatus {
  ACTIVE = "ACTIVE",
  ON_LEAVE = "ON_LEAVE",
  INACTIVE = "INACTIVE"
}
