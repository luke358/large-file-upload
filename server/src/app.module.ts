import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { diskStorage } from 'multer';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UPLOAD_DIR } from './utils';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: (req, file, cb) => {
          cb(null, `${UPLOAD_DIR}`);
        },
        filename: (req, file, cb) => {
          // 自定义文件名
          cb(null, randomUUID());
        },
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
