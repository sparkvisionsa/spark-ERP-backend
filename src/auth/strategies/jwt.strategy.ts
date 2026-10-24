import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { InjectModel } from "@nestjs/mongoose";
import { PassportStrategy } from "@nestjs/passport";
import { Model } from "mongoose";
import { ExtractJwt, Strategy } from "passport-jwt";
import { EmployeeStatus } from "../../common/enums/role.enum";
import { AuthUser } from "../../common/interfaces/auth-user.interface";
import { Employee, EmployeeDocument } from "../../employees/schemas/employee.schema";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService, @InjectModel(Employee.name) private readonly employeeModel: Model<EmployeeDocument>) {
    super({ jwtFromRequest: ExtractJwt.fromExtractors([(request) => request?.cookies?.spark_access || null]), ignoreExpiration: false, secretOrKey: config.getOrThrow<string>("JWT_ACCESS_SECRET") });
  }

  async validate(payload: { sub: string }): Promise<AuthUser> {
    const employee = await this.employeeModel.findOne({ _id: payload.sub, deletedAt: null, status: { $ne: EmployeeStatus.INACTIVE } }).lean();
    if (!employee) throw new UnauthorizedException("الحساب غير متاح");
    return { id: String(employee._id), role: employee.role, company: employee.company, fullName: employee.fullName, phone: employee.phone };
  }
}
