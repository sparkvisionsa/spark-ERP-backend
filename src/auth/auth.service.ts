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

  private async createAccessToken(employee: EmployeeDocument | any) {
    const payload = { sub: String(employee._id), role: employee.role, company: employee.company };
    return this.jwt.signAsync(payload, { secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"), expiresIn: this.config.get("JWT_ACCESS_EXPIRES", "24h") as any });
  }

  private async issue(employee: EmployeeDocument | any) {
    const accessToken = await this.createAccessToken(employee);
    const refreshToken = await this.jwt.signAsync({ sub: String(employee._id), type: "refresh" }, { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET"), expiresIn: this.config.get("JWT_REFRESH_EXPIRES", "30d") as any });
    const previousHashes = [
      ...(employee.refreshTokenHashes || []),
      ...(employee.refreshTokenHash ? [employee.refreshTokenHash] : []),
    ];
    // Keep refresh sessions independent for the latest ten device sign-ins.
    employee.refreshTokenHashes = [...previousHashes, await bcrypt.hash(refreshToken, 12)].slice(-10);
    employee.refreshTokenHash = undefined;
    employee.lastLoginAt = new Date();
    await employee.save();
    return { accessToken, refreshToken };
  }

  async login(dto: LoginDto) {
    const employee = await this.employeeModel.findOne({ ...this.identifierQuery(dto.identifier), deletedAt: null }).select("+passwordHash +refreshTokenHash +refreshTokenHashes");
    if (!employee || employee.status === EmployeeStatus.INACTIVE || !(await bcrypt.compare(dto.password, employee.passwordHash))) throw new UnauthorizedException("بيانات الدخول غير صحيحة");
    const tokens = await this.issue(employee);
    return { ...tokens, user: this.publicUser(employee) };
  }

  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException("انتهت جلسة الدخول");
    let payload: { sub: string; type: string };
    try { payload = await this.jwt.verifyAsync(token, { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET") }); } catch { throw new UnauthorizedException("انتهت جلسة الدخول"); }
    if (payload.type !== "refresh") throw new UnauthorizedException("انتهت جلسة الدخول");
    const employee = await this.employeeModel.findOne({ _id: payload.sub, deletedAt: null, status: { $ne: EmployeeStatus.INACTIVE } }).select("+refreshTokenHash +refreshTokenHashes");
    const hashes = [
      ...(employee?.refreshTokenHashes || []),
      ...(employee?.refreshTokenHash ? [employee.refreshTokenHash] : []),
    ];
    let validSession = false;
    for (const hash of hashes) {
      if (await bcrypt.compare(token, hash)) { validSession = true; break; }
    }
    if (!employee || !validSession) throw new UnauthorizedException("انتهت جلسة الدخول");
    // Keep the refresh token stable to avoid invalidating parallel requests or other open tabs.
    const accessToken = await this.createAccessToken(employee);
    return { accessToken, user: this.publicUser(employee) };
  }

  async me(user: AuthUser) {
    const employee = await this.employeeModel.findById(user.id).lean();
    if (!employee) throw new UnauthorizedException("الحساب غير متاح");
    return this.publicUser(employee);
  }

  async logout(token?: string) {
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string; type: string }>(token, { secret: this.config.getOrThrow<string>("JWT_REFRESH_SECRET") });
        if (payload.type === "refresh") {
          const employee = await this.employeeModel.findById(payload.sub).select("+refreshTokenHash +refreshTokenHashes");
          if (employee) {
            const hashes = employee.refreshTokenHashes || [];
            const matchingIndex = await this.findMatchingHash(token, hashes);
            const matchesLegacy = employee.refreshTokenHash
              ? await bcrypt.compare(token, employee.refreshTokenHash)
              : false;
            if (matchingIndex !== -1 || matchesLegacy) {
              const remainingHashes = matchingIndex === -1
                ? hashes
                : hashes.filter((_, index) => index !== matchingIndex);
              await this.employeeModel.updateOne(
                { _id: employee._id },
                { $set: { refreshTokenHashes: remainingHashes }, $unset: { refreshTokenHash: 1 } },
              );
            }
          }
        }
      } catch {
        // Logout still clears the browser cookies when the refresh token has expired.
      }
    }
    return { message: "تم تسجيل الخروج بنجاح" };
  }

  private async findMatchingHash(token: string, hashes: string[]) {
    for (let index = 0; index < hashes.length; index += 1) {
      if (await bcrypt.compare(token, hashes[index])) return index;
    }
    return -1;
  }
}
