FROM node:20-alpine

LABEL maintainer="MacArthur Lab"

WORKDIR /var/www

# Copy package files for dependency installation
COPY package.json pnpm-lock.yaml /var/www/

# Install pnpm and dependencies
RUN corepack enable && corepack prepare pnpm@8.14.0 --activate \
    && pnpm install --prod --frozen-lockfile

# Copy built dist folder
COPY dist /var/www/dist

# Cloud Run sets PORT env var (default 8080)
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/server.js"]
