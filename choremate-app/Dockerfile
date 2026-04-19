# ---- Stage 1: Build the React app ----
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --prefer-offline

COPY . .

# VITE_API_BASE_URL is injected at build time OR at runtime via window._env_
# We use runtime injection so one image works in all environments.
ARG BUILD_CMD="npm run build"
RUN ${BUILD_CMD}

# ---- Stage 2: Serve with Nginx ----
FROM nginx:1.27-alpine

# Remove default nginx config
RUN rm /etc/nginx/conf.d/default.conf

# Copy nginx template (BACKEND_URL will be substituted at container start)
COPY nginx.conf.template /etc/nginx/templates/default.conf.template

# Copy built React app
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

# nginx docker official image automatically runs envsubst on /etc/nginx/templates/*.template
CMD ["nginx", "-g", "daemon off;"]
