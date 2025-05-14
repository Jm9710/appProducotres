# Etapa 1: build
FROM node:20 AS builder

WORKDIR /app
COPY . .

RUN npm install
RUN npm run build

# Etapa 2: servidor estático
FROM nginx:alpine

# Copiar el build de Vite al directorio por defecto de nginx
COPY --from=builder /app/dist /usr/share/nginx/html

# Opcional: reemplazar configuración de Nginx si tenés rutas dinámicas (SPA)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
