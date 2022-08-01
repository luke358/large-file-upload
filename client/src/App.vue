<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import axios from 'axios'
const SIZE = 10 * 1024 * 1024;	// 10M

const resetData = {
	md5: null,
	md5percentage: 0,
	isMD5Loading: false,
	percentage: 0,
	isUploading: false,
	isMerging: false,
	isPaused: false,
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
	fileInfo.isMD5Loading = true;
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
				fileInfo.md5percentage = 0;
				fileInfo.isMD5Loading = false;
			}

			// 计算进度
			if (e.data.percentage > 0) {
				console.log('md5进度:' + e.data.percentage);
				fileInfo.md5percentage = e.data.percentage;
			}

			// 计算完成
			if (e.data.isOk && e.data.percentage === 100) {
				fileInfo.md5percentage = 0;
				fileInfo.isMD5Loading = false;
				resolve(e.data.md5);
			}
		};
	})
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

	if (!fileInfo.md5) {
		fileInfo.md5 = await computeMD5(fileInfo)
	}

	// MD5计算完成 发送预检请求，判断是否上传过
	const { shouldUpload, uploadedList, isOk } = await preVerifyUpload({
		filename: fileInfo.filename,
		md5: fileInfo.md5,
		totalChunks: Math.ceil(fileInfo.file.raw.size / SIZE),
		size: SIZE,
	});
	// shouldUpload 文件已经存在， isOk文件上传完毕，但是没有进行合并
	if (!shouldUpload || isOk) {
		alert("upload success!")
		return;
	}

	const noUploadedList = [...Array(totalChunks).keys()]
		.filter((_, index) => !uploadedList.includes(index))

	fileInfo.chunkList = [
		...noUploadedList.map((item: number) => ({
			percentage: 0,
			index: item,
			size: SIZE
		})), 
		...uploadedList.map((item: number) => ({
			percentage: 1,
			index: item,
			size: SIZE
		}))
	]

	fileInfo.isUploading = true
	fileInfo.isPaused = false
	await uploadChunks(noUploadedList, fileInfo, totalChunks)
	fileInfo.isUploading = false

	fileInfo.isMerging = true
	await uploadMerge({
		md5: fileInfo.md5,
		filename: fileInfo.filename,
		size: SIZE
	});
	fileInfo.isMerging = false
}

function onPaused (index: number) {
	uploadList.value[index].isPaused = true;
	uploadList.value[index].isUploading = false;
}

async function uploadChunks(noUploadedList: number[], fileInfo: any, totalChunks: number) {

	// TODO 失败重试
	return asyncPool(5, noUploadedList, (index: number) => {
		
		// 暂停
		if (fileInfo.isPaused) return Promise.reject();
		
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
		},
		onUploadProgress: (e) => {
			fileInfo.chunkList[chunkIndex].percentage = parseInt(String(e.loaded / e.total));
		}
	})
}

const progress = computed(() => {
	const progre1: number = progress.value ? +progress.value[0] : 0
	const progre2 = uploadList.value.map((fileInfo: any) => {
		const { chunkList, file } = fileInfo;

		if (!chunkList) return 0
		const loaded = chunkList.map((item: any) => item.size * item.percentage)
			.reduce((acc: number, cur: number) => acc + cur);

		if (loaded >= file.raw.size) return 100
		return ((loaded / file.raw.size) * 100).toFixed(2)
	})
	return progre1 > progre2 ? progre1 : progre2
})

async function uploadMerge(pamas: { md5: string, filename: string, size: number }) {
	const { data } = await axios.post('/api/uploadMerge', pamas)
	alert(data.msg)
}

async function asyncPool(limit: number, array: any[], iteratorFn: any) {
	const ret = [];
	const executing: any[] = [];
	for (const item of array) {
		let p = iteratorFn(item);
		p = p instanceof Promise ? p : Promise.resolve(p);
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
			<div v-for="({ file, isMD5Loading, md5percentage, isUploading, isMerging, isPaused }, index) in uploadList"
				class="upload-file">
				<span>{{ file.name }}</span>
				<span v-if="isMD5Loading">md5进度:{{ md5percentage }}%</span>
				<span v-else-if="isUploading || isPaused">上传进度:{{ progress[index] }}%</span>
				<span v-else-if="isMerging">合并中...</span>
				<div>
					<el-button v-if="!isPaused && !isUploading" type="primary" @click="uploadFile(index)">上传</el-button>
					<el-button v-else-if="isUploading" type="warning" @click="onPaused(index)">暂停</el-button>
					<el-button v-else type="warning" @click="uploadFile(index)">继续</el-button>
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
