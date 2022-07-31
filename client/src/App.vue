<script setup lang="ts">
import { ref, watch } from 'vue';
import axios from 'axios'
const SIZE = 10 * 1024 * 1024;	// 10M

const resetData = {
	md5: null,
	md5percentage: 0,
	isMD5Loading: false,
	percentage: 0,
}

const worker = ref<Worker>()
const uploadList = ref<any>([])
const onQueue = ref<boolean>(false)
const isMD5Loading = ref<boolean>(false)
const md5percentage = ref<number>()
const md5 = ref<string | boolean>()
const uploadingFileName = ref<string | null>(null)

function fileChange(file: File) {
	uploadList.value.push({
		file: file,
		...resetData,
		filename: file.name
	});
}
function beforeUpload(file: any) {
	return false;
}

function queueUpload(file: any) {
	// onQueue.value = true;
	// uploadFile(file)
}
// MD5 hash of the file
function computeMD5(fileInfo: any): Promise<any> {
	isMD5Loading.value = true;
	return new Promise((resolve, reject) => {
		const wk = new Worker('/md5.js');
		worker.value = wk;

		worker.value.postMessage({
			file: fileInfo.file.raw,
			size: SIZE,
		});
		worker.value.onmessage = e => {
			// 计算错误
			if (e.data.isError) {
				alert('文件读取错误!!')
				resolve(false);
				md5percentage.value = 0;
				isMD5Loading.value = false;
			}

			// 计算进度
			if (e.data.percentage > 0) {
				console.log('md5进度:' + e.data.percentage);
				md5percentage.value = e.data.percentage;
			}

			// 计算完成
			if (e.data.isOk && e.data.percentage === 100) {
				md5percentage.value = 0;
				isMD5Loading.value = false;
				resolve(e.data.md5);
			}
		};
	})
}
// 对文件进行切片
function createFileChunk(file: any, size = SIZE) {
	const fileChunkList = [];
	let cur = 0;
	let blobSlice = File.prototype.slice
	while (cur < file.size) {
		fileChunkList.push({ file: blobSlice.call(file.raw, cur, cur + size) });
		cur += size;
	}
	return fileChunkList;
}

async function preVerifyUpload(params: { filename: string, md5: string, totalChunks: number, size: number }) {
	const { data } = await axios.post('/api/preVerify', params)
	return data
}

const uploadFile = async (index: number) => {
	// 上传
	const fileInfo = uploadList.value[index]
	// const fileChunkList = createFileChunk(fileInfo.file);
	const totalChunks = Math.ceil(fileInfo.file.raw.size / SIZE)

	fileInfo.md5 = await computeMD5(fileInfo)

	// MD5计算完成 发送预检请求，判断是否上传过
	const { shouldUpload, uploadedList, isOk } = await preVerifyUpload({
		filename: fileInfo.filename,
		md5: fileInfo.md5,
		totalChunks: Math.ceil(fileInfo.file.raw.size / SIZE),
		size: SIZE,
	});

	if (!shouldUpload || isOk) {
		alert("upload success!")
		return;
	}

	const noUploadedList = [...Array(totalChunks).keys()]
		.filter((_, index) => !uploadedList.includes(index))

	
	await uploadChunks(noUploadedList, fileInfo, totalChunks)
}

async function uploadChunks(noUploadedList: number[], fileInfo: any, totalChunks: number) {

	// TODO 失败重试
	return asyncPool(5, noUploadedList, (index: number) => {
		return uploadChunk(fileInfo, index, totalChunks)
	})
}

async function uploadChunk(fileInfo: any, chunkIndex: number, totalChunks: number) {
	
	const formData = new FormData();
	
	const fileSize = fileInfo.file.raw.size
	let start = chunkIndex * SIZE;
	let end = start + SIZE >= fileSize ? fileSize : start + SIZE;
	// 只有轮到该切片上传的时候才进行切片
	formData.append("file", fileInfo.file.raw.slice(start, end));

	formData.append("chunkIndex", String(chunkIndex));
	formData.append("totalChunks", String(totalChunks));
	formData.append("chunkSize", String(SIZE));
	formData.append("filename", fileInfo.filename);
	formData.append("md5", fileInfo.md5);
	return axios.post('/api/upload', formData, {
		headers: {
			'Content-Type': 'multipart/form-data'
		}
	})
}

async function uploadMerge(pamas: any) {
	const { data } = await axios.post('/api/uploadMerge', pamas)
	alert(data.msg)
}

async function asyncPool(limit: number, array: any[], iteratorFn: any) {
	const ret = [];
	const executing: any[] = [];
	console.log(limit, array, iteratorFn);
	
	for (const item of array) {
		const p = iteratorFn(item);
		ret.push(p);
		if (limit <= array.length) {
			const e = p.then(() => {
				console.log('正在运行' + executing.length)
				executing.splice(executing.indexOf(e), 1)
			});
			executing.push(e);
			if (executing.length >= limit) {
				await Promise.race(executing);
			}
		}
	}
	return Promise.all(ret);
}

watch(uploadList.value, (files: any[]) => {
	// 上传文件
	// if (onQueue.value === true || files.length === 0) return;
	// queueUpload([...files][0]);
})
</script>

<template>
	<div>
		<el-upload ref="upload" class="upload-demo" :on-change="fileChange" :before-upload="beforeUpload"
			action="https://run.mocky.io/v3/9d059bf9-4660-45f2-925d-ce80ad6c4d15" :auto-upload="false">
			<template #trigger>
				<el-button type="primary">select file</el-button>
			</template>
		</el-upload>
		<div class="file-list">
			<div v-for="({ file }, index) in uploadList" class="upload-file">
				<span>{{ file.name }}</span>
				<div>
					<el-button type="primary" @click="uploadFile(index)">upload</el-button>
					<el-button type="warning">pause</el-button>
					<el-button type="danger">delete</el-button>
				</div>
			</div>
		</div>
	</div>
</template>

<style scoped>
.upload-file {
	margin-top: 20px;
	display: flex;
	justify-content: space-between;
}

.upload-demo>>>.el-upload-list {
	display: none;
}
</style>
