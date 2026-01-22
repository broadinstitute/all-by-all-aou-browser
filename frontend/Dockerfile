FROM node:16-alpine3.16

LABEL maintainer="MacArthur Lab"

WORKDIR /var/www
COPY package.json /var/www/
COPY dist /var/www/dist
RUN npm install --production --no-optional --legacy-peer-deps

CMD ["node", "dist/server.js"]
