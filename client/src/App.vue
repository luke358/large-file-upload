<script setup lang="ts">
import { ref, unref, watch } from 'vue';
const SIZE = 10 * 1024 * 1024;	// 10M

const fileList = ref<any>([])
const worker = ref<Worker>()
const uploadList = ref<any>([])
const onQueue = ref<boolean>(false)
const isMD5Loading = ref<boolean>(false)
const md5percentage = ref<number>()
const md5 = ref<string | boolean>()
const uploadingFileName = ref<string | null>(null)

function fileChange(file: File) {
	console.log("file change: ", file);
	fileList.value.push(file);
	uploadList.value.push(file);
}
function beforeUpload(file: any) {
	return false;
}

function queueUpload(file: any) {
	onQueue.value = true;
	upload(file)
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
				resolve({
					md5: e.data.md5
				});
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

async function preVerifyUpload(params: any) {

}

async function upload(file: any) {
	// 上传
	uploadingFileName.value = file.name;
	const fileChunkList = createFileChunk(file);
	md5.value = await computeMD5(fileChunkList)

	// MD5计算完成 发送预检请求，判断是否上传过

}

watch(uploadList.value, (files: any[]) => {
	// 上传文件
	if (onQueue.value === true || files.length === 0) return;
	queueUpload([...files][0]);
})
</script>

<template>
	<div>
		<el-upload ref="upload" :on-change="fileChange" :before-upload="beforeUpload" drag :limit="1"
			action="https://jsonplaceholder.typicode.com/posts/">
			<i class="el-icon-upload" />
			<div class="el-upload__text">
				将文件拖到此处，或<em>点击上传</em>
			</div>
			<div slot="tip" class="el-upload__tip">
				<!-- <div v-if="percentage > 0 && percentage < 100" class="upload-per">
					<div class="tit">
						{{ uploadingFileName }} - 上传中
						<span class="dotting" />
					</div>
					<el-progress :percentage="percentage" :stroke-width="3" style="margin-top: 5px;" />
				</div> -->

				<div v-if="isMD5Loading" class="md5-per">
					<div class="tit">
						{{ uploadingFileName }} - md5计算中
						<span class="dotting" />
					</div>
					<el-progress :percentage="md5percentage" :stroke-width="3" style="margin-top: 5px;" />
				</div>
			</div>

			<!-- <div
			slot="tip"
			class="el-upload__tip"
		>
			<div
				v-if="percentage > 0 && percentage < 100"
				class="upload-per"
			>
				<div class="tit">
					{{ uploadingFileName }} - 上传中
					<span class="dotting"/>
				</div>
				<el-progress
					:percentage="percentage"
					:stroke-width="3"
					style="margin-top: 5px;"
				/>
			</div>
			<div
				v-if="isMD5Loading"
				class="md5-per"
			>
				<div class="tit">
					{{ uploadingFileName }} - md5计算中
					<span class="dotting"/>
				</div>
				<el-progress
					:percentage="md5percentage"
					:stroke-width="3"
					style="margin-top: 5px;"
				/>
			</div>
		</div> -->
		</el-upload>
	</div>
</template>

<style scoped>
</style>
