FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

COPY package.json package-lock.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages

RUN npm ci --ignore-scripts

EXPOSE 4000

CMD ["npm", "run", "start", "--workspace", "@make-it-ai/api"]
