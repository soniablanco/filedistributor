FROM node:8.16.0-alpine

RUN mkdir /app/
COPY app/package.json  /app/package.json

RUN cd /app \
&& npm  install 


COPY app /app

ENTRYPOINT ["node","/app/app.js"]