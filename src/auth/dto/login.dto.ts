import { IsNotEmpty, IsString, MinLength } from "class-validator";

export class LoginDto {
  @IsString() @IsNotEmpty({ message: "أدخل رقم الهوية أو الجوال أو البريد الإلكتروني" }) identifier: string;
  @IsString() @MinLength(4, { message: "الرقم السري يجب ألا يقل عن 4 أحرف" }) password: string;
}
