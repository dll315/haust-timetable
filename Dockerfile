FROM node:22-alpine

# 时区必须设为东八区，否则 07:30 的判定和"今天"的课表都会算错一天
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone
ENV TZ=Asia/Shanghai

WORKDIR /app
COPY package.json ./
COPY data.js schedule-core.js push-core.js push.js server.js ./
COPY index.html styles.css ./

# 以非 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3579

# 用 docker run -e WECOM_WEBHOOK=... 注入机器人地址；-e PUSH_ENABLED=0 可临时停推
CMD ["node", "server.js", "3579", "--host=0.0.0.0"]
