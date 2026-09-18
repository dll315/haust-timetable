#!/usr/bin/env node
/* 本地服务：静态站点 + 推送配置读写 + 企业微信推送代理 + 每日定时调度
   node server.js [端口]        默认 5561，仅监听 127.0.0.1
   node server.js --no-scheduler  只提供网站，不跑定时任务 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const P = require("./push-core");

const ROOT = P.ROOT;
const STATE_PATH = path.join(ROOT, "push-state.json");
const argv = process.argv.slice(2);
const PORT = Number(argv.find((a) => /^\d+$/.test(a))) || 5561;
const SCHEDULER = !argv.includes("--no-scheduler");
const opt = (name, dft) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? dft;
const HOST = opt("host", process.env.HOST || "127.0.0.1");
const TOKEN = opt("token", process.env.PUSH_TOKEN || "");
const CATCHUP_MS = 90 * 60 * 1000;

/* 绝不能通过 HTTP 直接读到的文件：里面有 webhook 密钥和运行状态 */
const BLOCKED = new Set(["push-config.json", "push-state.json", "Dockerfile", ".gitignore"]);

const MIME = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8", ".md": "text/markdown; charset=utf-8",
};

const { S, SC } = P.load();
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")); } catch (e) { return { lastSentDate: null, history: [] }; }
}
function writeState(s) {
  try { fs.writeFileSync(STATE_PATH, JSON.stringify(s, null, 2) + "\n", "utf8"); } catch (e) { /* 只影响去重记录 */ }
}

/* 对外一律不返回完整 webhook，只给末 6 位用于识别，避免接口被扫后密钥泄露 */
function publicConfig() {
  const cfg = P.readConfig();
  const key = (cfg.webhook || "").split("key=")[1] || "";
  return {
    webhook: "",
    webhookSet: !!cfg.webhook,
    webhookHint: key ? `…${key.slice(-6)}` : "",
    enabled: cfg.enabled,
    time: cfg.time,
    sendIfEmpty: cfg.sendIfEmpty,
    state: readState(),
  };
}

async function doSend({ date, force }) {
  const cfg = P.readConfig();
  if (!cfg.webhook) throw new Error("尚未保存 webhook 地址");
  const target = date ? new Date(date + "T00:00:00") : new Date();
  const msg = SC.buildDayMessage(target);
  if (msg.count === 0 && !cfg.sendIfEmpty && !force) {
    return { skipped: true, reason: "今天没有课，且已设置为无课时不推送", message: msg.markdown.content };
  }
  const res = await P.send(cfg.webhook, msg);
  return {
    ok: res.errcode === 0,
    errcode: res.errcode,
    errmsg: res.errmsg,
    count: msg.count,
    date: dayKey(target),
    message: msg.markdown.content,
  };
}

function handleApi(req, res, url) {
  const send = (code, obj) => {
    const body = JSON.stringify(obj);
    res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(body);
  };
  const fail = (e) => send(400, { error: e.message || String(e) });

  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const payload = body ? (() => { try { return JSON.parse(body); } catch (e) { return {}; } })() : {};

    if (url.pathname === "/api/config" && req.method === "GET") {
      return send(200, publicConfig());
    }
    if (url.pathname === "/api/config" && req.method === "PUT") {
      const patch = {};
      if (payload.webhook === null || payload.webhook === "__clear__") patch.webhook = "";
      else if (typeof payload.webhook === "string" && payload.webhook.trim()) patch.webhook = payload.webhook.trim();
      if (typeof payload.enabled === "boolean") patch.enabled = payload.enabled;
      if (typeof payload.time === "string" && /^\d{2}:\d{2}$/.test(payload.time)) patch.time = payload.time;
      if (typeof payload.sendIfEmpty === "boolean") patch.sendIfEmpty = payload.sendIfEmpty;
      try { P.writeConfig(patch); return send(200, { saved: true, ...publicConfig() }); } catch (e) { return fail(e); }
    }
    if (url.pathname === "/api/preview" && req.method === "GET") {
      const d = url.searchParams.get("date");
      const target = d ? new Date(d + "T00:00:00") : new Date();
      const msg = SC.buildDayMessage(target);
      return send(200, { date: dayKey(target), count: msg.count, content: msg.markdown.content });
    }
    if (url.pathname === "/api/push" && req.method === "POST") {
      if (payload.mode === "test") {
        return P.send(payload.webhook || P.readConfig().webhook, P.buildTestMessage(S))
          .then((r) => send(200, { ok: r.errcode === 0, errcode: r.errcode, errmsg: r.errmsg }))
          .catch(fail);
      }
      return doSend(payload).then((r) => send(200, r)).catch(fail);
    }
    return send(404, { error: "接口不存在" });
  });
}

/* ---------------- 每日定时调度 ---------------- */
let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const cfg = P.readConfig();
    if (!cfg.enabled || !cfg.webhook) return;
    const now = new Date();
    const key = dayKey(now);
    const st = readState();
    if (st.lastSentDate === key) return;
    const [h, m] = cfg.time.split(":").map(Number);
    const at = new Date(now); at.setHours(h, m, 0, 0);
    if (now < at) return;
    // 只在到点后的补发窗口内触发，避免很晚启动服务时立刻推送一条打扰消息
    if (now - at > CATCHUP_MS) return;

    const r = await doSend({});
    st.lastSentDate = key;
    st.lastResult = { at: now.toISOString(), ok: r.ok !== false && !r.skipped, skipped: !!r.skipped, count: r.count ?? 0, errmsg: r.errmsg || r.reason || "" };
    st.history = [...(st.history || []).slice(-13), st.lastResult];
    writeState(st);
    console.log(`[推送] ${key} ->`, st.lastResult.ok ? `成功 ${st.lastResult.count} 节课` : `未发送/失败：${st.lastResult.errmsg}`);
  } catch (e) {
    console.error("[推送] 失败：", e.message);
    const st = readState();
    st.lastSentDate = dayKey(new Date());
    st.lastResult = { at: new Date().toISOString(), ok: false, skipped: false, count: 0, errmsg: e.message };
    writeState(st);
  } finally {
    ticking = false;
  }
}

/* ---------------- 静态文件 ---------------- */
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || rel.startsWith(".") || BLOCKED.has(rel)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" }); res.end("403"); return;
  }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }); res.end("404"); return; }
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/api/")) {
    if (TOKEN && req.headers["x-push-token"] !== TOKEN && url.searchParams.get("token") !== TOKEN) {
      res.writeHead(401, { "Content-Type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "需要访问口令", needToken: true }));
      return;
    }
    return handleApi(req, res, url);
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  serveStatic(req, res, url);
});

server.listen(PORT, HOST, () => {
  console.log(`课表网站  http://${HOST}:${PORT}/`);
  if (process.env.WECOM_WEBHOOK)
    console.log("⚠ webhook 由环境变量注入，网页里改 Webhook 不会生效（环境变量优先）");
  if (TOKEN) console.log("接口口令   已开启（/api/* 需要 x-push-token）");
  else if (HOST !== "127.0.0.1" && HOST !== "localhost")
    console.log("⚠ 正在公网监听但未设口令：任何人都能调用推送接口，建议 node server.js --token=你的口令");
  if (SCHEDULER) {
    const cfg = P.readConfig();
    console.log(`定时推送   ${cfg.enabled ? `已启用，每天 ${cfg.time}` : "未启用（在网站设置里打开）"}`);
    setInterval(tick, 30e3);
    setTimeout(tick, 2e3);
  } else {
    console.log("定时推送   已关闭（--no-scheduler）");
  }
});
