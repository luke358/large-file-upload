import {
  Body,
  Controller,
  Get,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('preVerify')
  preVerify(
    @Body()
    params: {
      filename: string;
      md5: string;
      totalChunks: number;
      size: number;
    },
  ) {
    return this.appService.getPreVerify(params);
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  upload(@UploadedFile() file, @Body() body) {
    return this.appService.upload(file, body);
  }

  @Post('uploadMerge')
  uploadMerge(@Body() body) {
    return this.appService.uploadMerge(body);
  }
}
