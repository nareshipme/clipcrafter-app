FROM node:20-slim

# Install system deps + yt-dlp + deno in one layer (deno needed for YouTube n-challenge)
# cache-bust: 2026-03-24
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    curl \
    unzip \
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
    && rm -rf /var/lib/apt/lists/* \
    && curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh \
    && deno --version \
    && yt-dlp --version

WORKDIR /app

# Install ALL deps (including devDeps needed for build like @tailwindcss/postcss)
COPY package*.json ./
RUN npm ci

# Bake all required env vars at build time so `next build` page data collection succeeds
ENV NEXT_PUBLIC_SUPABASE_URL=https://gdipsivdokqmpskhhagg.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkaXBzaXZkb2txbXBza2hoYWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzY1MjAsImV4cCI6MjA4OTUxMjUyMH0.1U7XHTyouwJoK5MrL6cITli58He38rw82RWlF6FCsgs
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_bWF0dXJlLWFkZGVyLTU1LmNsZXJrLmFjY291bnRzLmRldiQ
ENV NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
ENV NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
ENV NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
ENV SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdkaXBzaXZkb2txbXBza2hoYWdnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzkzNjUyMCwiZXhwIjoyMDg5NTEyNTIwfQ.XFDvgO5crm5siT5aUxkkxnzQhTXYo2VGMIiJ8QH1X1s
ENV CLERK_SECRET_KEY=sk_test_zHI5rBfKltIp6mfP2FdBL0uIWWE2N1NM6O1sI1YGVJ

# Copy source and build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm run build

# Prune dev deps after build
RUN npm prune --omit=dev

EXPOSE 3000

CMD ["npm", "start"]

