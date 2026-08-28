FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY backend/package.json backend/package.json
COPY shared/package.json shared/package.json
RUN npm install

FROM deps AS build
COPY shared shared
COPY backend backend
RUN npm -w @climasense/shared run build
RUN npm -w @climasense/backend run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/package.json backend/package.json
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/shared/package.json shared/package.json
CMD ["node", "backend/dist/main.js"]
