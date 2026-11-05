import { IsIn, IsString, MaxLength, MinLength } from "class-validator";

export class TranslateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;

  @IsIn(["ar", "en"])
  target: "ar" | "en";
}
