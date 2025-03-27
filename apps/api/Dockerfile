FROM node:18 AS build
WORKDIR /app
RUN npm install --global nx@20
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx nx build api

FROM node:18 AS prod
WORKDIR /app
COPY --from=build /app/dist/apps/api ./dist/apps/api
WORKDIR /app/dist/apps/api
RUN npm install
EXPOSE 3000
CMD ["node", "main.js"]

FROM node:18 AS dev
WORKDIR /app
RUN npm install --global nx@20
COPY package*.json ./
RUN npm ci --legacy-peer-deps
COPY . .
EXPOSE 3000
CMD ["npx", "nx", "serve", "api"]