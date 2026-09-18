/* 推送核心：加载课表数据 -> 生成当日消息 -> 发送到企业微信群机器人 */
"use strict";

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const https = require("https");

const ROOT = __dirname;
const WEBHOOK_RE = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]{8,}$/;

function load() {
  const ctx = vm.createContext({ console });
  vm.runInContext("globalThis.window = globalThis;", ctx);
  for (const f of ["data.js", "schedule-core.js"]) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  }
  return { S: ctx.SCHEDULE, SC: ctx.ScheduleCore.create(ctx.SCHEDULE) };
}

/* 当日课表消息由 schedule-core.js 的 SC.buildDayMessage(date) 生成，
   与网站预览共用同一份逻辑，避免两边显示不一致。 */

function send(webhook, payload) {
  return new Promise((resolve, reject) => {
    if (!WEBHOOK_RE.test(webhook)) {
      reject(new Error("Webhook 地址不合法，应为 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx"));
      return;
    }
    const body = JSON.stringify({ msgtype: "markdown", ...payload });
    const req = https.request(
      webhook,
      { method: "POST", headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) } },
      (res) => {
        let raw = "";
        res.setEncoding("utf8");
        res.on("data", (c) => (raw += c));
        res.on("end", () => {
          let json = null;
          try { json = JSON.parse(raw); } catch (e) { /* 非 JSON 响应 */ }
          if (!json) { reject(new Error(`响应无法解析（HTTP ${res.statusCode}）：${raw.slice(0, 200)}`)); return; }
          resolve({ httpStatus: res.statusCode, ...json });
        });
      }
    );
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("请求超时（10s）")));
    req.end(body);
  });
}

function buildTestMessage(S) {
  return {
    markdown: {
      content: [
        `## ✅ 推送测试成功`,
        `> ${S.student.name} 的课表机器人已连通 · ${new Date().toLocaleString("zh-CN")}`,
      ].join("\n\n"),
    },
  };
}

/* ---------------- 配置读写 ---------------- */
const CONFIG_PATH = path.join(ROOT, "push-config.json");
const DEFAULT_CONFIG = { webhook: "", enabled: false, time: "07:30", sendIfEmpty: true };

/* 环境变量优先级最高，便于 GitHub Actions / Docker 用 Secret 注入而无需配置文件 */
function readConfig() {
  let cfg = { ...DEFAULT_CONFIG };
  try {
    cfg = { ...cfg, ...JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8")) };
  } catch (e) { /* 首次运行或文件损坏，用默认值 */ }
  if (process.env.WECOM_WEBHOOK) cfg.webhook = process.env.WECOM_WEBHOOK.trim();
  if (process.env.PUSH_ENABLED) cfg.enabled = process.env.PUSH_ENABLED !== "0";
  if (process.env.PUSH_TIME) cfg.time = process.env.PUSH_TIME;
  if (process.env.PUSH_SEND_EMPTY) cfg.sendIfEmpty = process.env.PUSH_SEND_EMPTY !== "0";
  return cfg;
}

function writeConfig(patch) {
  const next = { ...readConfig(), ...patch };
  if (next.webhook && !WEBHOOK_RE.test(next.webhook)) {
    throw new Error("Webhook 地址格式不正确");
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(next, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  return next;
}

module.exports = {
  load, buildTestMessage, send,
  readConfig, writeConfig,
  WEBHOOK_RE, CONFIG_PATH, ROOT,
};
