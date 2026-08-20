FROM node:20-bookworm-slim AS deps

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY scripts ./scripts

RUN mkdir -p /var/www/janji-nikah/uploads \
  && chown -R node:node /app /var/www/janji-nikah/uploads

USER node

EXPOSE 5010

CMD ["npm", "start"]
