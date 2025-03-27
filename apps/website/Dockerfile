FROM node:18 AS build
WORKDIR /app
RUN npm install --global nx@20
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx nx build website


FROM nginx:alpine AS prod
COPY --from=build /app/dist/apps/website /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


FROM node:18 AS dev
WORKDIR /app
RUN npm install --global nx@20
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 4200
CMD ["npx", "nx", "preview", "website"]
