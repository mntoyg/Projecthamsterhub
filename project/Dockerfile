# K-SES API. Portable on purpose: Render, Railway, Fly.io and a plain VPS all
# take a Dockerfile, so the deploy target is not baked into the repository.
#
# Node 22 is required, not preferred: server/db.ts uses node:sqlite.
FROM node:22-alpine

WORKDIR /app

# Dependencies first, so a source change does not reinstall them.
# --omit=dev is why tsx lives in dependencies: it is what runs the server.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# The server imports the shared decision engine from src/, so src/ ships too.
COPY tsconfig.json tsconfig.server.json ./
COPY server ./server
COPY scripts ./scripts
COPY src ./src

# SQLite file lives outside the image. On a host with no persistent disk this
# is ephemeral: rooms reseed on restart and history is lost. That is acceptable
# for a demo and must not be described as a database that keeps data.
RUN mkdir -p /data && chown -R node:node /data
VOLUME ["/data"]

ENV NODE_ENV=production \
    PORT=8787 \
    DB_FILE=/data/k-ses.db

# Do not run as root.
USER node

EXPOSE 8787

# Hosts that do their own health checks should point them at /api/health.
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["npm", "run", "server"]
