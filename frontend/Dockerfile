FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Note: Nginx exposes 80 by default. We'll route through Traefik.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
