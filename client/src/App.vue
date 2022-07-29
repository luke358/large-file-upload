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
function computeMD5(fileChunkList: any[]): Promise<any> {
	isMD5Loading.value = true;
	return new Promise((resolve, reject) => {
		const wk = new Worker('/md5.js');
		worker.value = wk;

		worker.value.postMessage({
			fileChunkList
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
				md5percentage.value = Number(e.data.percentage.toFixed(1));
			}

			// 计算完成
			if (e.data.md5 && e.data.percentage === 100) {
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
	const file = uploadList.value[index]
	const fileChunkList = createFileChunk(file.file);
	file.md5 = await computeMD5(fileChunkList)
	file.fileChunkList = fileChunkList

	// MD5计算完成 发送预检请求，判断是否上传过
	const { shouldUpload, uploadedList, msg } = await preVerifyUpload({
		filename: file.filename,
		md5: file.md5,
		totalChunks: fileChunkList.length,
		size: SIZE,
	});

	if (msg) {
		return alert(msg);
	}

	if (!shouldUpload) {
		alert("upload success!")
		return;
	}

	await uploadChunks(uploadedList, fileChunkList.map(item => ({
		chunk: item.file,
		md5: file.md5,
		filename: file.filename,
		size: SIZE
	})), file)
}

async function uploadChunks(uploadedList: any[], fileChunkList: any[], file: any) {
	const totalChunks = fileChunkList.length
	const requestList = fileChunkList
		.filter((item, index) => !uploadedList.includes(index))
		.map(({ chunk, size, md5, filename }, index) => {
			const formData = new FormData();
			formData.append("file", chunk);
			formData.append("chunkIndex", String(index));
			formData.append("totalChunks", String(totalChunks));
			formData.append("chunkSize", String(size));
			formData.append("filename", filename);
			formData.append("md5", md5);

			return { formData, index };
		}).map(({ formData }) => axios.post('/api/upload', formData, {
			headers: {
				'Content-Type': 'multipart/form-data'
			}
		}))

	// TODO 并发控制，失败重试
	await Promise.all(requestList);

	if (uploadedList.length + requestList.length === totalChunks) {
		await uploadMerge({
			md5: file.md5,
			filename: file.filename, 
			size: SIZE
		});
	}
	// Promise.all(requestList).then(res => {
	// 	console.log(res);
	// })
	// console.log(requestList);
}

async function uploadMerge(pamas: any) {
	const { data } = await axios.post('/api/uploadMerge', pamas)
	alert(data.msg)
}

// async function asyncPool(poolLimit: any, array: any, iteratorFn: any) {
//     const ret = []; // 存储所有的异步任务
//     const executing: any[] = []; // 存储正在执行的异步任务
//     for (const item of array) {
//         // 调用iteratorFn函数创建异步任务
//         const p = Promise.resolve().then(() => iteratorFn(item, array));
//         ret.push(p); // 保存新的异步任务

//         // 当poolLimit值小于或等于总任务个数时，进行并发控制
//         if (poolLimit <= array.length) {
//             // 当任务完成后，从正在执行的任务数组中移除已完成的任务
//             const e = p.then(() => executing.splice(executing.indexOf(e), 1));
//             executing.push(e); // 保存正在执行的异步任务
//             if (executing.length >= poolLimit) {
//             	await Promise.race(executing); // 等待较快的任务执行完成
//             }
//         }
//     }
//     return Promise.all(ret);
// }

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
