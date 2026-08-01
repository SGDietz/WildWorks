FROM node:22.18-alpine AS build
WORKDIR /service
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
COPY config ./config
COPY test ./test
RUN npm test && npm run typecheck && npm run build

FROM node:22.18-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /service
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /service/dist ./dist
COPY --from=build /service/config ./config
USER node
EXPOSE 10000
CMD ["node", "dist/server.js"]
