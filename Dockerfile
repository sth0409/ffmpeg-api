FROM node:20-slim

# 安装完整 FFmpeg（包含 libass，支持 ASS 硬烧） + 常用字体
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 先复制 package.json 并安装依赖
COPY package*.json ./
RUN npm install --production     # ←←← 改成这一行（去掉 ci）

# 复制所有代码
COPY . .

EXPOSE 3000

CMD ["node", "index.js"]
