import { CompanyKey, Role } from "../enums/role.enum";

export interface AuthUser {
  id: string;
  role: Role;
  company: CompanyKey | null;
  fullName: string;
  phone?: string;
}
