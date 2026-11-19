FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
RUN npm ci --ignore-scripts
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
