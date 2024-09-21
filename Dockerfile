# Stage 1: Build the NestJS application
FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm

# Set the working directory inside the container
WORKDIR /app

# Install dependencies
COPY pnpm-lock.yaml ./
COPY package.json ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN pnpm prisma generate

# Build the application
RUN pnpm build

# Stage 2: Production image
FROM node:22-alpine AS runner

# Install pnpm
RUN npm install -g pnpm

WORKDIR /app

# Copy the compiled application and Prisma client from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy the .env file
COPY .env .env

# Expose the port the app runs on
EXPOSE 1234

# Command to run the application with Prisma migration
CMD pnpm prisma migrate deploy && node dist/main
