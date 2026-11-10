# Imagen única: compila la web y la sirve junto con la API y el WebSocket en el mismo puerto.
FROM node:22-slim AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
RUN rm -rf data
COPY --from=web /app/web/dist /app/web/dist
EXPOSE 3000
CMD ["npm", "start"]
