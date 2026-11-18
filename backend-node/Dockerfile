FROM node:22-bookworm-slim
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
ENV NODE_ENV=production
EXPOSE 8000
CMD ["sh", "-c", "npm run db:migrate && npm start"]
