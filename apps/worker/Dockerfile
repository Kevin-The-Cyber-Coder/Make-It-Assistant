FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/worker/package.json apps/worker/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm install --ignore-scripts

COPY tsconfig.json ./
COPY apps/worker apps/worker
COPY packages/shared packages/shared

EXPOSE 4100
CMD ["npm", "run", "start", "--workspace", "@make-it-ai/worker"]
