import { Body, Controller, Post, UseGuards } from "@nestjs/common";
import { ApiCookieAuth, ApiTags } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { TranslateDto } from "./dto/translate.dto";
import { TranslationService } from "./translation.service";

@ApiTags("translation")
@ApiCookieAuth("spark_access")
@UseGuards(JwtAuthGuard)
@Controller("translation")
export class TranslationController {
  constructor(private readonly translationService: TranslationService) {}

  @Post()
  translate(@Body() dto: TranslateDto) {
    return this.translationService.translate(dto.text, dto.target);
  }
}
