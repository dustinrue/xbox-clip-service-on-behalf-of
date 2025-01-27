FROM node:16-alpine

WORKDIR /app
COPY . .
RUN npm install --no-dev

CMD ["npm", "start"]
