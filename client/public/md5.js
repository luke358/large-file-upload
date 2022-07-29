// 导入脚本
self.importScripts("/spark-md5.min.js");

// 生成文件 hash
self.onmessage = e => {
  const { fileChunkList } = e.data;
  const spark = new self.SparkMD5.ArrayBuffer();
  let percentage = 0;
  let count = 0;
  const reader = new FileReader();
  reader.onload = e => {
    spark.append(e.target.result);
    if (count === fileChunkList.length) {
      self.postMessage({
        percentage: 100,
        md5: spark.end()
      });
      self.close();
    } else {
      percentage += 100 / fileChunkList.length;
      self.postMessage({
        percentage
      });
      loadNext(count);
    }
  }
  reader.onerror = function() {
		self.postMessage({
			isError: true
		});
	};
  const loadNext = index => {
    count++;
    reader.readAsArrayBuffer(fileChunkList[index].file);
  };
  loadNext(0);
};