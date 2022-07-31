import { Injectable } from '@nestjs/common';
import * as path from 'path';
import * as fse from 'fs-extra';
import {
  createChunkDir,
  createUploadedList,
  extractExt,
  mergeChunks,
  UPLOAD_DIR,
} from './utils';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }

  async getPreVerify(body: {
    filename: string;
    md5: string;
    totalChunks: number;
    size: number;
  }) {
    const { filename, md5, totalChunks, size } = body;
    // 通过 md5读取文件目录是否存在文件
    const ext = extractExt(filename);
    const filePath = path.resolve(UPLOAD_DIR, `${md5}${ext}`);
    const chunkDir = createChunkDir(md5);

    // 之前合并文件失败过，重新合并
    if (fse.existsSync(filePath) && fse.existsSync(chunkDir)) {
      // 合并文件
      return await mergeChunks({ filename, md5, size });
    }
    // 如果全部存在则上传完毕
    if (fse.existsSync(filePath)) {
      return {
        shouldUpload: false,
      };
    }

    const uploadedList = (await createUploadedList(md5)).map((_) => Number(_));

    if (uploadedList.length === totalChunks) {
      console.log('pre, 文件切片已全部上传, 开始合并');
      // 合并文件
      return await mergeChunks({ filename, md5, size });
    }
    // 如果存在部分进行续传
    return {
      shouldUpload: true,
      uploadedList,
    };
  }

  async upload(file, body) {
    const { md5, chunkIndex } = body;

    const chunkDir = createChunkDir(md5);
    const chunkPath = path.resolve(chunkDir, chunkIndex);
    if (fse.existsSync(chunkPath)) {
      return 'chunk exist';
    }
    // 初次上传 切片目录不存在，创建切片目录
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir);
    }

    await fse.move(file.path, path.resolve(chunkDir, chunkIndex), {
      overwrite: true,
    });
    return {
      isOk: true,
    };
  }

  async uploadMerge(body) {
    const { md5, filename, size } = body;
    return await mergeChunks({ md5, filename, size });
  }
}
