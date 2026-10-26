FROM node:22-bookworm-slim
WORKDIR /app
COPY backend-node/package*.json ./
RUN npm ci
COPY backend-node/ ./
ENV NODE_ENV=production
EXPOSE 8000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
