// 导入脚本
self.importScripts("/spark-md5.min.js");

// 生成文件 hash
self.onmessage = e => {
  const { file, size } = e.data;
  const chunks = Math.ceil(file.size / size);
  const fileSize = file.size
  const spark = new self.SparkMD5.ArrayBuffer();
  const startTime = new Date().getTime();

  let blobSlice =
    File.prototype.slice ||
    File.prototype.mozSlice ||
    File.prototype.webkitSlice;

  let currentChunk = 0;

  const reader = new FileReader();

  loadNext();

  reader.onload = e => {
    spark.append(e.target.result);
    if (currentChunk < chunks) {
      currentChunk++;
      let percentage = ((currentChunk / chunks) * 100).toFixed(2);
      self.postMessage({
        isOk: false,
        percentage
      });
      loadNext();
    } else {
      let md5 = spark.end();
      self.postMessage({
        isOk: true,
        percentage: 100.00,
        md5
      });
      console.log(
        `MD5计算完毕：${file.name} \nMD5：${md5} \n分片：${chunks} 大小:${fileSize
        } 用时：${new Date().getTime() - startTime} ms`
      );
    }
  }
  reader.onerror = function () {
    self.postMessage({
      isError: true
    });
  };
  function loadNext() {
    let start = currentChunk * size;
    let end =
      start + size >= fileSize ? fileSize : start +
        size;
    reader.readAsArrayBuffer(blobSlice.call(file, start, end));
  }
};