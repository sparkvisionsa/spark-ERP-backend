import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { InjectModel } from "@nestjs/mongoose";
import * as bcrypt from "bcrypt";
import { Model } from "mongoose";
import { EmployeeStatus } from "../common/enums/role.enum";
import { AuthUser } from "../common/interfaces/auth-user.interface";
import { EmployeesService } from "../employees/employees.service";
import { Employee, EmployeeDocument } from "../employees/schemas/employee.schema";
import { LoginDto } from "./dto/login.dto";

@Injectable()
export class AuthService {
  constructor(@InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>, private readonly jwt: JwtService, private readonly config: ConfigService) {}

  private identifierQuery(identifier: string) {
    const value = identifier.trim();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { email: value.toLowerCase() };
    if (/^\d{10}$/.test(value) && !value.startsWith("05")) return { nationalId: value };
    return { phone: EmployeesService.normalizePhone(value) };
  }

  private publicUser(employee: EmployeeDocument | any) {
    return { id: String(employee._id), fullName: employee.fullName, phone: employee.phone, email: employee.email, nationalId: employee.nationalId, role: employee.role, company: employee.company, department: employee.department, jobTitle: employee.jobTitle, status: employee.status };
  }

  private async issue(employee: EmployeeDocument | any) {
    const payload = { sub: String(employee._id), role: employee.role, company: employee.company };
    const accessToken = await this.jwt.signAsync(payload, { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"), expiresIn: this.config.get("JWT_ACCESS_EXPIRES", "15m") as any });
    const refreshToken = await this.jwt.signAsync({ sub: String(employee._id), type: "refresh" }, { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"), expiresIn: this.config.get("JWT_REFRESH_EXPIRES", "7d") as any });
    employee.refreshTokenHash = await bcrypt.hash(refreshToken, 12);
    employee.lastLoginAt = new Date();
    await employee.save();
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const employee = await this.employeeModel.findOne({ ...this.identifierQuery(dto.identifier), deletedAt: null }).select("+passwordHash +refreshTokenHash");
    if (!employee || employee.status === EmployeeStatus.INACTIVE || !(await bcrypt.compare(dto.password, employee.passwordHash))) throw new UnauthorizedException("بيانات الدخول غير صحيحة");
    const tokens = await this.issue(employee);
    return { ...tokens, user: this.publicUser(employee) };
  }

  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException("انتهت جلسة الدخول");
    let payload: { sub: string; type: string };
    try { payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET") }); } catch { throw new UnauthorizedException("انتهت جلسة الدخول"); }
    const employee = await this.employeeModel.findOne({ _id: payload.sub, deletedAt: null, status: { $ne: EmployeeStatus.INACTIVE } }).select("+refreshTokenHash");
    if (!employee?.refreshTokenHash || !(await bcrypt.compare(token, employee.refreshTokenHash))) throw new UnauthorizedException("انتهت جلسة الدخول");
    const tokens = await this.issue(employee);
    return { ...tokens, user: this.publicUser(employee) };
  }

  async me(user: AuthUser) {
    const employee = await this.employeeModel.findById(user.id).lean();
    if (!employee) throw new UnauthorizedException("الحساب غير متاح");
    return this.publicUser(employee);
  }

  async logout(userId?: string) {
    if (userId) await this.employeeModel.updateOne({ _id: userId }, { $unset: { refreshTokenHash: 1 } });
    return { message: "تم تسجيل الخروج بنجاح" };
  }
}
