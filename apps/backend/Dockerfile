FROM node:18 AS build
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
ENV PNPM_HOME=/root/.pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV PORT=3000
COPY . .
RUN pnpm add --global turbo \
&&  pnpm install --frozen-lockfile
# RUN pnpm run build --filter api
EXPOSE ${PORT}
CMD ["pnpm", "run", "dev", "--filter", "api"]

# FROM node:18 AS dev
# WORKDIR /app
# ENV PORT=3000
# COPY --from=build /app ./
# EXPOSE ${PORT}
# CMD ["pnpm", "run", "dev", "--filter", "api"]