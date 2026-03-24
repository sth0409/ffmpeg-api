import { Hono } from 'hono';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const app = new Hono();
const execAsync = promisify(exec);

const upload = multer({ dest: '/tmp/uploads/' });

// 健康检查
app.get('/ping', (c) => c.text('pong'));

// ASS 字幕硬烧端点（核心功能）
app.post('/burn/ass', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'ass', maxCount: 1 },
  { name: 'font', maxCount: 10 }   // 支持多个字体文件
]), async (c) => {
  try {
    const videoFile = c.req.file('video');
    const assFile = c.req.file('ass');
    const fontFiles = c.req.files('font') || [];

    if (!videoFile || !assFile) {
      return c.json({ error: '缺少 video 或 ass 文件' }, 400);
    }

    const inputVideo = videoFile.path;
    const inputAss = assFile.path;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;

    // 创建字体目录并复制字体
    const fontsDir = '/tmp/fonts';
    await fs.mkdir(fontsDir, { recursive: true });
    for (const font of fontFiles) {
      await fs.copyFile(font.path, path.join(fontsDir, font.originalname));
    }

    // FFmpeg 命令：硬烧 ASS 字幕
    const command = `ffmpeg -i "${inputVideo}" -vf "ass='${inputAss}':fontsdir='${fontsDir}'" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k "${outputPath}" -y`;

    console.log('执行命令:', command);
    await execAsync(command);

    // 返回处理后的文件
    const fileBuffer = await fs.readFile(outputPath);
    await fs.unlink(outputPath); // 清理

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="with_subs.mp4"'
      }
    });

  } catch (err) {
    console.error(err);
    return c.json({ error: err.message }, 500);
  }
});

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch
};
