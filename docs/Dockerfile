FROM node:22-alpine AS build
WORKDIR /build
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
ARG DOCS_BASE=/apps/shoot4fun
ENV DOCS_BASE=$DOCS_BASE
RUN npm run build

FROM nginx:alpine
COPY --from=build /build/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
