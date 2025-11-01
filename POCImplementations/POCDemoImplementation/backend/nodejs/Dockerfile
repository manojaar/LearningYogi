FROM node:20-slim

# Install system dependencies for Sharp PDF/image processing
# libvips-dev provides image processing, poppler-utils for PDF support
RUN apt-get update && apt-get install -y --no-install-recommends \
    libvips-dev \
    poppler-utils \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application code
COPY . .

# Build TypeScript
RUN npm run build

# Copy schema.sql to dist directory (TypeScript doesn't copy .sql files)
COPY src/database/schema.sql dist/database/schema.sql

# Expose port
EXPOSE 4000

# Start server
CMD ["npm", "start"]

