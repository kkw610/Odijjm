FROM node:22-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install

# npm install한 playwright 버전에 정확히 맞는 크로미움 + 시스템 의존성을 같이 설치한다.
RUN npx playwright install --with-deps chromium

COPY server.js ./

EXPOSE 3000
CMD ["node", "server.js"]
