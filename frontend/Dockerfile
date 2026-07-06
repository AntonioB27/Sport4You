# ---- build stage ----
FROM node:20-alpine AS build
WORKDIR /app

# Install deps first (layer caches on unchanged lockfile)
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle
COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html
EXPOSE 80
