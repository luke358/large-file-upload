import * as fse from 'fs-extra';
import * as path from 'path';
export const UPLOAD_DIR = '/Users/macuser/Desktop/test';

// 创建临时文件夹用于临时存储 chunk
export const createChunkDir = (md5: string) =>
  path.resolve(UPLOAD_DIR, `chunkDir_${md5}`);

export const extractExt = (filename) =>
  filename.slice(filename.lastIndexOf('.'), filename.length);

/**
 * 读取目录获取文件上传进度
 * @param md5 文件唯一hash
 * @returns 未上传列表
 */
export const createUploadedList = async (md5) =>
  fse.existsSync(path.resolve(UPLOAD_DIR, `chunkDir_${md5}`))
    ? await fse.readdir(path.resolve(UPLOAD_DIR, `chunkDir_${md5}`))
    : [];

export const mergeChunks = async (data) => {
  const { md5, filename, size } = data;
  const ext = extractExt(filename);
  const filePath = path.resolve(UPLOAD_DIR, `${md5}${ext}`);

  const chunkDir = createChunkDir(md5);
  const chunkPaths = (await fse.readdir(chunkDir))
    .filter((_) => _ === _)
    .sort((a, b) => +a - +b);

  try {
    await Promise.all(
      chunkPaths.map((chunkPath) => {
        return pipeStream(
          path.resolve(chunkDir, chunkPath),
          fse.createWriteStream(filePath, {
            start: +chunkPath * size,
          }),
        );
      }),
    );
  } catch (e) {
    return {
      msg: '文件合并失败, 请重试',
    };
  }

  fse.rmdirSync(chunkDir);

  return {
    msg: '上传成功',
    isOk: true,
  };
};

const pipeStream = (path, writeStream) =>
  new Promise<void>((resolve, reject) => {
    const readStream = fse.createReadStream(path);
    readStream.on('end', () => {
      fse.unlinkSync(path);
      resolve();
    });
    readStream.on('error', (err) => {
      reject(err);
    });
    readStream.pipe(writeStream);
  });
