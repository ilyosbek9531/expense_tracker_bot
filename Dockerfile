# Stage 1: Build the application
FROM node:18 AS builder

# Set the working directory inside the container
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Install dependencies
COPY package.json ./
COPY pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy the rest of the application code
COPY . .

# Build the application
RUN pnpm build

# Stage 2: Production image
FROM node:18 AS runner

# Set the working directory inside the container
WORKDIR /app

# Copy the compiled application and dependencies from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/node_modules ./node_modules

# Copy the .env file
COPY .env .env

# Expose the port the app runs on
EXPOSE 1234

# Command to run the application with Prisma migration
CMD pnpm prisma migrate deploy && pnpm start
