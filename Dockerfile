FROM node:20-slim

# Install system deps: ffmpeg (full build = drawtext/libfreetype support on Debian), yt-dlp, Chromium for Remotion
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    fonts-liberation \
    libnss3 \
    libatk-bridge2.0-0 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

WORKDIR /app

# Install ALL deps (including devDeps needed for build like @tailwindcss/postcss)
# cache-bust: 2026-03-23
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Prune dev deps after build
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "start"]

