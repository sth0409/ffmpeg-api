import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const app = new Hono();
const execAsync = promisify(exec);

// 健康检查
app.get('/ping', (c) => c.text('pong'));

// ASS 字幕硬烧端点（使用 Hono 原生方式处理文件上传）
app.post('/burn/ass', async (c) => {
  try {
    const body = await c.req.parseBody({ all: true });
    
    const videoFile = body['video'];   // File 对象
    const assFile = body['ass'];       // File 对象
    const fontFiles = Array.isArray(body['font']) ? body['font'] : body['font'] ? [body['font']] : [];

    if (!videoFile || !videoFile.name) {
      return c.json({ error: '缺少 video 文件' }, 400);
    }
    if (!assFile || !assFile.name) {
      return c.json({ error: '缺少 ass 文件' }, 400);
    }

    const inputVideo = `/tmp/input_${Date.now()}.mp4`;
    const inputAss = `/tmp/subtitle_${Date.now()}.ass`;
    const outputPath = `/tmp/output_${Date.now()}.mp4`;
    const fontsDir = `/tmp/fonts_${Date.now()}`;

    await fs.mkdir(fontsDir, { recursive: true });

    // 保存上传的文件
    await fs.writeFile(inputVideo, Buffer.from(await videoFile.arrayBuffer()));
    await fs.writeFile(inputAss, Buffer.from(await assFile.arrayBuffer()));

    // 保存字体文件
    for (let i = 0; i < fontFiles.length; i++) {
      const font = fontFiles[i];
      if (font && font.name) {
        await fs.writeFile(path.join(fontsDir, font.name), Buffer.from(await font.arrayBuffer()));
      }
    }

    // FFmpeg 硬烧字幕命令
    const command = `ffmpeg -i "${inputVideo}" -vf "ass='${inputAss}':fontsdir='${fontsDir}'" \
      -c:v libx264 -preset medium -crf 23 \
      -c:a aac -b:a 128k "${outputPath}" -y`;

    console.log('执行 FFmpeg:', command);
    await execAsync(command);

    const fileBuffer = await fs.readFile(outputPath);

    // 清理临时文件
    [inputVideo, inputAss, outputPath].forEach(p => fs.unlink(p).catch(() => {}));
    await fs.rm(fontsDir, { recursive: true, force: true }).catch(() => {});

    return new Response(fileBuffer, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': 'attachment; filename="with_subs.mp4"'
      }
    });

  } catch (err) {
    console.error('处理失败:', err);
    return c.json({ error: err.message || '内部错误' }, 500);
  }
});

// ====================== 启动服务器 ======================
const port = Number(process.env.PORT) || 8080;

console.log(`🚀 Server starting on port ${port} (0.0.0.0)`);

serve({
  fetch: app.fetch,
  port: port,
  hostname: '0.0.0.0'
}, (info) => {
  console.log(`✅ Server is running on http://0.0.0.0:${info.port}`);
});