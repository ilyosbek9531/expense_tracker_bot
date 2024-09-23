# Stage 1: Build the NestJS application
FROM node:22 AS builder

# Set the working directory inside the container
WORKDIR /app

# Install dependencies
COPY package.json ./
COPY package-lock.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Stage 2: Production image
FROM node:22 AS runner

WORKDIR /app

# Copy the compiled application and Prisma client from the build stage
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules ./node_modules

# Copy the .env file
COPY .env .env

# Expose the port the app runs on
EXPOSE 1234

# Command to run the application with Prisma migration
CMD npm run prisma:migrate:deploy && node dist/main
