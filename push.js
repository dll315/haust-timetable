#!/usr/bin/env node
/* 命令行推送：供 Windows 任务计划程序在每天 07:30 调用
   node push.js [preview|test|send] [--date=2026-09-21] [--force] */
"use strict";

const P = require("./push-core");

const args = process.argv.slice(2);
const cmd = (args.find((a) => !a.startsWith("--")) || "preview").toLowerCase();
const flag = (name) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const has = (name) => args.includes(`--${name}`);

function resolveDate() {
  const raw = flag("date");
  if (!raw) return new Date();
  const d = new Date(raw + "T00:00:00");
  if (isNaN(d)) {
    console.error(`--date 格式错误：${raw}，应为 YYYY-MM-DD`);
    process.exit(1);
  }
  return d;
}

async function main() {
  const { S, SC } = P.load();
  const cfg = P.readConfig();
  const date = resolveDate();
  const msg = SC.buildDayMessage(date);

  if (cmd === "preview") {
    console.log(msg.markdown.content);
    console.log(`\n--- 共 ${msg.count} 节课 ---`);
    return;
  }

  if (!cfg.webhook) {
    console.error("未配置 webhook：请在网站设置里保存，或编辑 push-config.json");
    process.exit(1);
  }

  if (cmd === "test") {
    const res = await P.send(cfg.webhook, P.buildTestMessage(S));
    console.log(res.errcode === 0 ? "✅ 测试消息已送达" : `❌ 发送失败：${res.errcode} ${res.errmsg}`);
    process.exitCode = res.errcode === 0 ? 0 : 1;
    return;
  }

  if (cmd === "send") {
    if (!cfg.enabled && !has("force")) {
      console.log("推送已在配置中关闭（--force 可强制发送）");
      return;
    }
    if (msg.count === 0 && !cfg.sendIfEmpty && !has("force")) {
      console.log("今天没有课，且已设置为无课时不推送，跳过");
      return;
    }
    const res = await P.send(cfg.webhook, msg);
    console.log(
      res.errcode === 0
        ? `✅ 已推送 ${SC.fmtCN(date)} 课表（${msg.count} 节课）`
        : `❌ 发送失败：${res.errcode} ${res.errmsg}`
    );
    process.exitCode = res.errcode === 0 ? 0 : 1;
    return;
  }

  console.error(`未知命令：${cmd}（可用 preview | test | send）`);
  process.exit(1);
}

main().catch((e) => {
  console.error("❌ " + e.message);
  process.exit(1);
});
