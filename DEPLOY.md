# 部署说明

三种方式，按「功能完整度」和「运维成本」取舍。先看结论：

| 方式 | 网页在线访问 | 设置面板可保存 | 07:30 自动推送 | 需要常开机器 |
|---|---|---|---|---|
| 1. 服务器直接跑 | ✅ | ✅ | ✅ | 是你的服务器 |
| 2. Docker 单容器 | ✅ | ✅ | ✅ | 是你的服务器 |
| 3. Pages + Actions | ✅ | ❌ 只读 | ✅（有延迟） | 不需要 |

**核心约束**：企业微信机器人接口不返回 CORS 头，浏览器直连拿不到回执（实测只有 `no-cors` 能发出但无法确认送达）。所以推送必须由 Node 执行，纯静态托管做不了推送。

---

## 准备工作

```bash
git clone git@github.com:dll315/haust-timetable.git
cd haust-timetable
cp push-config.example.json push-config.json   # 可选，也可以直接网页里填
node --version                                  # 需要 >= 18
```

### 时区（最容易踩的坑）

代码用 `new Date()` 判断"今天星期几、第几周"。服务器若是 UTC，北京 07:30 会被算成"昨天 23:30"，**推送会推错一天的课表**。必须显式设置：

```bash
timedatectl set-timezone Asia/Shanghai   # 或直接给进程 Environment=TZ=Asia/Shanghai
```

### 安全须知

`push-config.json` 里是你的机器人密钥，已在 `.gitignore` 中，**不要提交**。服务端也做了三层防护：

1. 该文件（及 `push-state.json`、`Dockerfile`）无法通过 HTTP 读取，直接 403
2. `GET /api/config` 不回显完整 webhook，只给末 6 位
3. 公网监听时务必加 `--token=`，否则任何人都能调你的 `/api/push` 刷屏

---

## 方式一：服务器上直接部署（端口 3579）

### 1. 前台试跑一次

```bash
node server.js 3579 --host=0.0.0.0 --token=随便一串长口令
```

看到这样的输出就对了：

```
课表网站  http://0.0.0.0:3579/
接口口令   已开启（/api/* 需要 x-push-token）
定时推送   未启用（在网站设置里打开）
```

浏览器打开 `http://服务器IP:3579/`，右上角 ⚙ 填 webhook、打开「启用每日推送」、点「发送测试消息」验证。

### 2. 做成 systemd 常驻服务

```bash
sudo useradd -r -s /usr/sbin/nologin timetable
sudo mkdir -p /opt/haust-timetable
sudo cp -r ./* /opt/haust-timetable/        # 含 .github 也无妨
sudo chown -R timetable:timetable /opt/haust-timetable
sudo chmod 600 /opt/haust-timetable/push-config.json
```

`/etc/systemd/system/haust-timetable.service`：

```ini
[Unit]
Description=HAUST Timetable & WeCom Push
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=timetable
WorkingDirectory=/opt/haust-timetable
Environment=TZ=Asia/Shanghai
ExecStart=/usr/bin/node server.js 3579 --host=0.0.0.0 --token=换成你的口令
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now haust-timetable
sudo systemctl status haust-timetable
journalctl -u haust-timetable -f          # 看推送日志
```

`which node` 若不在 `/usr/bin/node`，把 `ExecStart` 改成实际路径。

### 3. 放行端口

```bash
# 云厂商控制台的安全组也要放行 TCP 3579，光开本机防火墙不够
sudo firewall-cmd --permanent --add-port=3579/tcp && sudo firewall-cmd --reload
# 或 Ubuntu: sudo ufw allow 3579/tcp
```

### 4. 自检

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3579/            # 200
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3579/push-config.json  # 403，说明没泄露
curl -s http://127.0.0.1:3579/api/config                                   # 401 需要口令
curl -s -H 'x-push-token: 你的口令' http://127.0.0.1:3579/api/config        # 200 JSON
```

### 5. 有 nginx 的话（推荐）

不必把 3579 暴露公网，让 nginx 反代并加 HTTPS：

```nginx
server {
    listen 443 ssl;
    server_name timetable.example.com;
    # ssl_certificate ...; ssl_certificate_key ...;
    location / { proxy_pass http://127.0.0.1:3579; }
}
```

此时 `ExecStart` 改回 `--host=127.0.0.1`，`--token` 仍然建议保留。

---

## 方式二：Docker 单容器部署

### 1. 构建

```bash
docker build -t haust-timetable .
```

`.dockerignore` 已排除 `push-config.json`，密钥不会进镜像。

### 2. 运行

```bash
docker run -d --name timetable \
  --restart unless-stopped \
  -p 3579:3579 \
  -e TZ=Asia/Shanghai \
  -e WECOM_WEBHOOK='https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx' \
  -e PUSH_ENABLED=1 \
  -e PUSH_TOKEN='换成你的口令' \
  haust-timetable
```

```
浏览器打开 http://服务器IP:3579/
```

### 3. 验证与运维

```bash
docker logs -f timetable
docker exec -it timetable node push.js preview      # 看今天该发什么
docker exec -it timetable node push.js send --force # 立刻真发一条
docker update --restart=unless-stopped timetable
```

### 4. 两个注意点

- **环境变量优先于配置文件**。一旦传了 `WECOM_WEBHOOK`，网页里改 Webhook 不生效（启动日志会提示）。想用网页管理就去掉该环境变量，并挂卷保存配置：
  ```bash
  docker run -d --name timetable --restart unless-stopped -p 3579:3579 \
    -e TZ=Asia/Shanghai -e PUSH_ENABLED=1 \
    -v $PWD/data:/app \
    haust-timetable
  ```
  但把整个 `/app` 覆盖掉会让代码文件也走宿主目录，更稳妥的做法是改用方式一。
- 容器内以非 root 运行，`push-config.json` 写在容器层，**重建镜像会丢**，所以推荐用环境变量注入。

### 5. docker-compose 版本

```yaml
services:
  timetable:
    build: .
    container_name: timetable
    restart: unless-stopped
    ports: ["3579:3579"]
    environment:
      TZ: Asia/Shanghai
      WECOM_WEBHOOK: ${WECOM_WEBHOOK}
      PUSH_ENABLED: "1"
      PUSH_TOKEN: ${PUSH_TOKEN}
```

同目录建 `.env` 写入两个变量，`docker compose up -d`。

---

## 方式三：网页走 GitHub Pages，推送走 Actions cron

### ⚠️ 先决定隐私问题

Pages 免费托管要求**公开仓库**，而课表数据打包在 `data.js` 里随页面一起下发。也就是说你的姓名、学号 `260320030579`、学院专业、每天几点在哪个教室，全部对全网可见，且会被搜索引擎收录。

建议先做脱敏再上线，编辑 `data.js`：

```js
student: { name: "同学", id: "已隐藏", college: "车辆与交通工程学院", major: "动力工程" },
```

教师姓名是否保留，你自己权衡。

### 1. 开 Pages

仓库 → Settings → Pages → Build and deployment → Source 选 `Deploy from a branch` → Branch 选 `main` / `/(root)` → Save。

项目是零依赖纯静态，不需要构建步骤，约一分钟后得到
`https://dll315.github.io/haust-timetable/`。

国内访问 GitHub Pages 不稳定（偶发连不上或很慢），手机在国内网络下要有心理准备。

### 2. 配 Actions 密钥

```bash
gh secret set WECOM_WEBHOOK --repo dll315/haust-timetable <<< 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxx'
```

或网页：Settings → Secrets and variables → Actions → New repository secret，名字必须是 `WECOM_WEBHOOK`。

### 3. 定时任务

仓库里已带 `.github/workflows/daily-push.yml`，要点：

- `cron: "30 23 * * *"` —— Actions 用 UTC，23:30 UTC 即北京 07:30
- `env.TZ: Asia/Shanghai` —— 不设会推错一天，**这行不能删**
- `PUSH_ENABLED: "1"` —— Actions 环境里没有 `push-config.json`，默认 `enabled=false` 会直接跳过
- 多了 `workflow_dispatch`，可以在 Actions 页面手动点「Run workflow」测试，还能传 `date` 参数试算任意一天

### 4. 手动验证

```bash
gh workflow run daily-push.yml --repo dll315/haust-timetable
gh run list --workflow=daily-push.yml --repo dll315/haust-timetable
```

先看 job 日志里 `node push.js preview` 那一步的输出对不对，再看 send 是否返回 `errcode 0`。

### 5. 这条路的固有缺陷

- **Actions 定时触发不保证准点**，官方文档明确说明高峰期可能延迟数分钟到数十分钟，个别情况会跳过。对"7:30 上课提醒"够用，别当打卡系统。
- 仓库 60 天无活动，GitHub 会自动停用 scheduled workflow（Settings → Actions → General 里可关）。
- Pages 上设置面板会显示「本地服务未连接」，只能看不能存 —— 这是静态托管的本质限制。

---

## 常见问题

**收到 `93000 invalid webhook url`** —— key 错了或机器人被移出群。

**收到 `45009` 之类** —— 机器人被限频（每机器人 20 条/分钟）。

**推送内容日期不对** —— 十有八九是时区，回到「准备工作」那节。

**想临时停推送** —— 网页里关掉「启用每日推送」保存；或 `docker stop timetable`；或删掉 Actions secret。

**改了课表怎么办** —— 研究生系统排课会变。重新抓一次数据覆盖 `data.js` 即可，其余代码不用动。
