import { Hono } from 'hono';
import multer from 'multer';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const app = new Hono();
const execAsync = promisify(exec);

const upload = multer({ dest: '/tmp/uploads/' });

// 健康检查（先测试这个）
app.get('/ping', (c) => c.text('pong'));

// ASS 字幕硬烧端点
app.post('/burn/ass', upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'ass', maxCount: 1 },
  { name: 'font', maxCount: 10 }
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
    const fontsDir = '/tmp/fonts';

    await fs.mkdir(fontsDir, { recursive: true });
    for (const font of fontFiles) {
      await fs.copyFile(font.path, path.join(fontsDir, font.originalname));
    }

    const command = `ffmpeg -i "${inputVideo}" -vf "ass='${inputAss}':fontsdir='${fontsDir}'" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k "${outputPath}" -y`;

    console.log('执行 FFmpeg 命令:', command);
    await execAsync(command);

    const fileBuffer = await fs.readFile(outputPath);
    // 清理临时文件
    await fs.unlink(outputPath).catch(() => {});

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="with_subs.mp4"'
      }
    });

  } catch (err) {
    console.error('处理失败:', err);
    return c.json({ error: err.message }, 500);
  }
});

// === 关键：启动 Node.js 服务器 ===
const port = Number(process.env.PORT) || 3000;

console.log(`🚀 Server starting on port ${port} (0.0.0.0)`);

Bun.serve ? 
  Bun.serve({ fetch: app.fetch, port }) :   // 如果意外用了 Bun
  app.listen(port, '0.0.0.0', () => {
    console.log(`✅ Server is running on http://0.0.0.0:${port}`);
  });
