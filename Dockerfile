# Stage 1: Build the Angular frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm ci
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# Stage 2: Setup the backend server
FROM node:20-alpine
WORKDIR /app

# Copy root package configurations
COPY package*.json ./

# Copy backend package configurations and install dependencies
COPY backend-excel/package*.json ./backend-excel/
RUN cd backend-excel && npm ci

# Copy backend code and initial database templates
COPY backend-excel/ ./backend-excel/

# Copy the compiled static frontend from Stage 1
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

# Expose the API and static server port
EXPOSE 3000

# Start the Node.js monolithic app
CMD ["node", "backend-excel/server.js"]
