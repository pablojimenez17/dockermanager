FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci

COPY . .

# Expose backend port
EXPOSE 5000

# Start command
CMD ["npm", "start"]
