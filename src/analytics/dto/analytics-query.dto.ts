import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, Max, Min } from "class-validator";
import { CompanyKey } from "../../common/enums/role.enum";

export class AnalyticsQueryDto {
  @IsOptional() @IsEnum(CompanyKey, { message: "الشركة غير صحيحة" }) company?: CompanyKey;
  @IsOptional() @Type(() => Number) @IsInt() @Min(7) @Max(365) days = 30;
}
