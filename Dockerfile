FROM node:latest

RUN apt-get update && apt-get install -y \
    chromium python3 python3-dev python3-venv python3-pip \
    libnss3-dev zip \
    ffmpeg imagemagick webp \
    && rm -rf /var/lib/apt/lists/*

COPY package.json .

RUN npm i

COPY . .

EXPOSE 8080

CMD ["node", "index"]
