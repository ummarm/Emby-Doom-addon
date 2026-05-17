FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV HOST=0.0.0.0
ENV PORT=7000

EXPOSE 7000

CMD ["npm", "start"]
