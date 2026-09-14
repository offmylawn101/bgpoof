import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
const url =
  'https://huggingface.co/imgly/isnet-general-onnx/resolve/440dea96dd4a3b06bbbf5abec3e26569dd7ec49f/onnx/model_fp16.onnx';
const sha = (data) => createHash('sha256').update(data).digest('hex');
const response = await fetch(url);
if (!response.ok) throw new Error(`Model download failed: ${response.status}`);
const model = Buffer.from(await response.arrayBuffer());
if (
  sha(model) !==
  '2eb4b5dda7ec41c617e59706e5aafa1f978c9a5f983d2518d9f0ae4d6eb04f20'
)
  throw new Error('Model checksum mismatch');
const dir = 'public/models/isnet-fp16-v1';
await mkdir(dir, { recursive: true });
const parts = [];
for (
  let start = 0, i = 0;
  start < model.length;
  start += 16 * 1024 * 1024, i++
) {
  const data = model.subarray(start, start + 16 * 1024 * 1024);
  const name = `model-${String(i).padStart(2, '0')}.bin`;
  await writeFile(`${dir}/${name}`, data);
  parts.push({ name, size: data.length, sha256: sha(data) });
}
await writeFile(
  `${dir}/manifest.json`,
  JSON.stringify({ size: model.length, sha256: sha(model), parts }, null, 2) +
    '\n',
);
console.log('Verified and prepared IS-Net model.');
