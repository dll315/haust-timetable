(function () {
  "use strict";

  const S = window.SCHEDULE;
  const SC = window.ScheduleCore.create(S);
  const {
    DAY_NAMES, TOTAL_WEEKS, courses, sessions,
    dateOf, weekdayOf, weekOf, fmtMD, toMins, bellFor, slotLabel, secLabel, sessionsOn,
  } = SC;
  const pad = (n) => String(n).padStart(2, "0");
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };

  /* ---------------- 状态 ---------------- */
  let viewWeek = Math.min(Math.max(weekOf(new Date()), 1), TOTAL_WEEKS);
  let viewMode = "grid";
  let listDay = null;

  /* ---------------- 顶栏与状态条 ---------------- */
  function renderStatic() {
    const st = S.student;
    $("#avatar").textContent = st.name[0];
    $("#stuName").textContent = st.name;
    $("#stuDept").innerHTML =
      `${st.college} · ${st.major}<br>学号 ${st.id}`;
    $("#semTitle").textContent = `${S.semester.academicYear} 学年 ${S.semester.term}`;
    $("#footNote").innerHTML =
      `数据来源：河南科技大学研究生管理系统 · 个人课表（${S.semester.scrapedAt} 抓取）<br>` +
      `节次时间来源：河南科技大学教务处《作息时间》 · 第 1 周起始日为 ${S.semester.week1Monday}`;
  }

  function renderStatusStrip() {
    const now = new Date();
    const w = weekOf(now);
    $("#nowWeek").textContent = w >= 1 && w <= TOTAL_WEEKS ? w : "—";
    if (w >= 1 && w <= TOTAL_WEEKS) {
      const a = dateOf(w, 1), b = dateOf(w, 7);
      $("#nowRange").textContent = `${fmtMD(a)} — ${fmtMD(b)} · ${DAY_NAMES[weekdayOf(now) - 1]}`;
    } else {
      $("#nowRange").textContent = "不在本学期周次范围内";
    }
    const pct = Math.max(0, Math.min(100, (w / TOTAL_WEEKS) * 100));
    $("#termProgress").style.width = pct.toFixed(1) + "%";
    $("#termProgressLabel").textContent = `学期进度 第 ${w} / ${TOTAL_WEEKS} 周`;
  }

  function renderNext() {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const nx = SC.findNext(now);
    const title = $("#nextTitle"), sub = $("#nextSub"), fill = $("#nextFill");
    if (!nx) {
      title.textContent = "暂无后续课程";
      sub.textContent = "本学期课程已全部结束";
      fill.style.width = "100%";
      return;
    }
    const s = nx.session;
    const when = nx.off === 0 ? "今天" : nx.off === 1 ? "明天" : `${fmtMD(nx.date)} ${DAY_NAMES[s.day - 1]}`;
    title.innerHTML = `${nx.live ? "正在上课 · " : ""}${nx.course.name}`;
    sub.innerHTML = `${nx.time} · ${nx.sec}<br>${when} · ${s.teacher} · ${s.room}`;
    if (nx.live) {
      fill.style.width = (((cur - nx.st) / (nx.en - nx.st)) * 100).toFixed(1) + "%";
      sub.innerHTML += `<br>已上 ${cur - nx.st} 分钟，${nx.en - cur} 分钟后下课`;
    } else {
      const ms = nx.startAt - now.getTime();
      fill.style.width = Math.max(3, 100 - Math.min(100, (ms / 108e3) * 100)).toFixed(1) + "%";
      sub.innerHTML += `<br>距开课还有 ${SC.untilText(ms)}`;
    }
  }

  function renderClock() {
    const d = new Date();
    $("#clockTime").textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    $("#clockDate").textContent =
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${DAY_NAMES[weekdayOf(d) - 1]}`;
  }

  /* ---------------- 周次选择器 ---------------- */
  function renderPills() {
    const box = $("#weekPills");
    box.innerHTML = "";
    const now = new Date();
    const realWeek = weekOf(now);
    for (let w = 1; w <= TOTAL_WEEKS; w++) {
      const b = el("button", "pill" + (w === viewWeek ? " is-active" : "") + (w === realWeek ? " is-current" : ""), String(w));
      b.type = "button";
      const a = dateOf(w, 1), z = dateOf(w, 7);
      b.title = `第 ${w} 周 · ${fmtMD(a)} — ${fmtMD(z)}${w === realWeek ? "（本周）" : ""}`;
      b.onclick = () => setWeek(w);
      box.appendChild(b);
    }
    const active = box.querySelector(".is-active");
    if (active) box.scrollLeft = active.offsetLeft - box.clientWidth / 2 + active.clientWidth / 2;
  }

  function setWeek(w) {
    viewWeek = Math.min(Math.max(w, 1), TOTAL_WEEKS);
    listDay = null;
    renderPills();
    renderTimetable();
    renderList();
  }

  /* ---------------- 周视图 ---------------- */
  function renderTimetable() {
    const box = $("#timetable");
    box.innerHTML = "";
    const monday = dateOf(viewWeek, 1);
    const bell = bellFor(monday);
    const today = new Date();
    const isCurrent = weekOf(today) === viewWeek;
    const todayIdx = isCurrent ? weekdayOf(today) : -1;

    box.appendChild(el("div", "h-corner", "时间 / 节次"));
    for (let i = 0; i < 7; i++) {
      const d = dateOf(viewWeek, i + 1);
      const h = el("div", "h-day" + (i + 1 === todayIdx ? " is-today" : ""),
        `${DAY_NAMES[i]}<small>${fmtMD(d)}</small>`);
      h.style.gridColumn = 3 + i;
      box.appendChild(h);
    }

    S.bands.forEach((band) => {
      const b = el("div", "band", band.label);
      b.style.gridRow = `${1 + band.from} / span ${band.to - band.from + 1}`;
      box.appendChild(b);
    });

    for (let p = 1; p <= 12; p++) {
      const cell = el("div", "pcell", `<b>第${p}节</b><span>${bell.periods[p - 1].join(" - ")}</span>`);
      cell.style.gridRow = 1 + p;
      box.appendChild(cell);
    }

    for (let i = 0; i < 7; i++) {
      const col = el("div", "daycol" + (i + 1 === todayIdx ? " is-today" : ""));
      col.style.gridColumn = 3 + i;
      col.style.gridRow = `2 / span 12`;

      sessionsOn(viewWeek, i + 1).forEach((s) => {
        const c = courses.get(s.courseId);
        const blk = el("div", "blk" + (s.start === s.end ? " compact" : ""));
        blk.style.setProperty("--c", c.color);
        blk.style.top = `calc(${s.start - 1} * var(--row-h) + 3px)`;
        blk.style.height = `calc(${s.end - s.start + 1} * var(--row-h) - 6px)`;
        blk.innerHTML =
          `<div class="blk-name">${c.name}</div>` +
          `<div class="blk-time">${slotLabel(bell, s.start, s.end)} · ${secLabel(s.start, s.end)}</div>` +
          `<div class="blk-room" title="${s.room}">${s.room}</div>`;
        blk.onclick = () => openModal(s.courseId);
        col.appendChild(blk);
      });

      if (i + 1 === todayIdx) {
        const y = nowOffset(bell);
        if (y != null) {
          const line = el("div", "nowline");
          line.style.top = `calc(${y} * var(--row-h))`;
          line.title = "当前时间";
          col.appendChild(line);
        }
      }
      box.appendChild(col);
    }
  }

  function nowOffset(bell) {
    const d = new Date();
    const t = d.getHours() * 60 + d.getMinutes();
    for (let i = 0; i < 12; i++) {
      const st = toMins(bell.periods[i][0]);
      const en = toMins(bell.periods[i][1]);
      if (i === 0 && t < st) return 0;
      if (t < st) return i;
      if (t <= en) return i + (t - st) / (en - st);
    }
    return null;
  }

  /* ---------------- 列表视图 ---------------- */
  function renderList() {
    const tabs = $("#dayTabs");
    tabs.innerHTML = "";
    const today = new Date();
    const isCurrent = weekOf(today) === viewWeek;
    if (listDay == null) listDay = isCurrent ? weekdayOf(today) : 1;

    for (let i = 1; i <= 7; i++) {
      const d = dateOf(viewWeek, i);
      const n = sessionsOn(viewWeek, i).length;
      const t = el("button", "day-tab" + (i === listDay ? " is-active" : "") + (n ? "" : " is-empty"),
        `${DAY_NAMES[i - 1]}${isCurrent && i === weekdayOf(today) ? " · 今天" : ""}<small>${fmtMD(d)} · ${n} 节</small>`);
      t.type = "button";
      t.onclick = () => { listDay = i; renderList(); };
      tabs.appendChild(t);
    }

    const box = $("#dayList");
    box.innerHTML = "";
    const bell = bellFor(dateOf(viewWeek, 1));
    const list = sessionsOn(viewWeek, listDay);
    if (!list.length) {
      box.appendChild(el("div", "empty", `第 ${viewWeek} 周 ${DAY_NAMES[listDay - 1]} 没有课，好好享受～`));
      return;
    }
    list.forEach((s) => {
      const c = courses.get(s.courseId);
      const r = el("div", "row");
      r.style.setProperty("--c", c.color);
      r.innerHTML =
        `<div class="row-time">${slotLabel(bell, s.start, s.end)}<span>${secLabel(s.start, s.end)}</span></div>` +
        `<div><div class="row-name">${c.name}</div>` +
        `<div class="row-meta">${s.teacher} · ${s.room} · 第 ${s.weeks} 周 · 共 ${s.weekList.length} 次</div></div>` +
        `<div class="row-badge">${c.nature} · ${c.credits.toFixed(1)} 学分</div>`;
      r.onclick = () => openModal(s.courseId);
      box.appendChild(r);
    });
  }

  /* ---------------- 课程概览 ---------------- */
  function renderCourses() {
    const box = $("#courseGrid");
    box.innerHTML = "";
    S.courses.forEach((c) => {
      const mine = sessions.filter((s) => s.courseId === c.id);
      const all = [...new Set(mine.flatMap((s) => s.weekList))].sort((a, b) => a - b);
      const card = el("button", "ccard");
      card.type = "button";
      card.style.setProperty("--c", c.color);
      card.innerHTML =
        `<div class="ccard-top"><div><h3>${c.name}</h3><div class="ccard-en">${c.en}</div></div>` +
        `<span class="chip">${c.nature}</span></div>` +
        `<div class="ccard-meta">` +
        `<span><i>学分</i> ${c.credits.toFixed(1)}</span>` +
        `<span><i>总学时</i> ${c.totalHours}</span>` +
        `<span><i>考核</i> ${c.assess}</span>` +
        `<span><i>任课</i> ${[...new Set(mine.map((s) => s.teacher))].join("、")}</span>` +
        `</div>` +
        `<div class="ccard-weeks">第 ${all.join("、")} 周 · 每周 ${mine.length} 个时段</div>`;
      card.onclick = () => openModal(c.id);
      box.appendChild(card);
    });
  }

  /* ---------------- 详情弹窗 ---------------- */
  function openModal(id) {
    const c = courses.get(id);
    const mine = sessions.filter((s) => s.courseId === id);
    const bell = bellFor(dateOf(viewWeek, 1));
    $("#modalBody").innerHTML =
      `<div class="m-head"><h2>${c.name}</h2><span class="chip">${c.nature}</span></div>` +
      `<p class="m-en">${c.en}</p><div class="m-bar"></div>` +
      `<div class="m-grid">
        <div class="m-cell"><i>课程编号</i><b>${c.code}</b></div>
        <div class="m-cell"><i>开课学院</i><b>${c.college}</b></div>
        <div class="m-cell"><i>学分 / 总学时</i><b>${c.credits.toFixed(1)} / ${c.totalHours}</b></div>
        <div class="m-cell"><i>周学时</i><b>${c.weeklyHours || "—"}</b></div>
        <div class="m-cell"><i>考核方式</i><b>${c.assess}</b></div>
        <div class="m-cell"><i>上课语言</i><b>${c.language}</b></div>
        <div class="m-cell"><i>主讲教师</i><b>${c.professor}</b></div>
        <div class="m-cell"><i>任课教师</i><b>${[...new Set(mine.map((s) => s.teacher))].join("、")}</b></div>
      </div>
      <div class="m-sec"><h4>上课时间地点</h4>${mine.map((s) =>
        `<div class="m-slot"><b>${DAY_NAMES[s.day - 1]} ${secLabel(s.start, s.end)}</b>` +
        `<span>${slotLabel(bell, s.start, s.end)} · ${s.room} · ${s.teacher} · 第 ${s.weeks} 周</span></div>`).join("")}</div>
      <div class="m-sec"><h4>课程简介</h4><p class="m-text">${c.intro}</p></div>`;
    const m = $("#modal");
    m.querySelector(".modal-panel").style.setProperty("--c", c.color);
    m.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeModal() {
    $("#modal").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------------- 视图切换与主题 ---------------- */
  function setView(v) {
    viewMode = v;
    document.querySelectorAll(".seg-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.view === v));
    $("#viewGrid").classList.toggle("hidden", v !== "grid");
    $("#viewList").classList.toggle("hidden", v !== "list");
  }

  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("haust-timetable-theme", t); } catch (e) { /* 隐私模式忽略 */ }
  }

  /* ---------------- 推送设置 ---------------- */
  const LS_PUSH = "haust-timetable-push";
  const LS_TOKEN = "haust-timetable-token";
  const WEBHOOK_RE = /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=[A-Za-z0-9-]{8,}$/;
  let backend = false;
  let pushCfg = { webhookSet: false, webhookHint: "", enabled: false, time: "07:30", sendIfEmpty: true, state: null };

  function setStatus(text, kind) {
    const n = $("#pushStatus");
    n.textContent = text;
    n.className = "status" + (kind ? ` ${kind}` : "");
  }

  function renderPill() {
    const on = pushCfg.enabled && pushCfg.webhookSet;
    $("#pushPill").classList.toggle("on", !!on);
    $("#pushPillText").textContent = on
      ? `每日 ${pushCfg.time} 推送`
      : pushCfg.webhookSet ? "推送已暂停" : "配置推送";
  }

  function fillForm() {
    const i = $("#cfWebhook");
    i.value = "";
    i.placeholder = pushCfg.webhookSet
      ? `已保存 ${pushCfg.webhookHint} —— 留空表示不修改`
      : "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx";
    $("#cfClear").hidden = !pushCfg.webhookSet;
    $("#cfEnabled").checked = !!pushCfg.enabled;
    $("#cfEmpty").checked = pushCfg.sendIfEmpty !== false;
    $("#cfTime").value = pushCfg.time || "07:30";
  }

  const readForm = () => {
    const hook = $("#cfWebhook").value.trim();
    const out = {
      enabled: $("#cfEnabled").checked,
      sendIfEmpty: $("#cfEmpty").checked,
      time: $("#cfTime").value || "07:30",
    };
    if (hook) out.webhook = hook;
    return out;
  };

  async function api(path, opts = {}, retry = true) {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    let tk = null;
    try { tk = localStorage.getItem(LS_TOKEN); } catch (e) { /* 隐私模式忽略 */ }
    if (tk) headers["x-push-token"] = tk;

    const r = await fetch(path, { ...opts, headers });
    if (r.status === 401 && retry) {
      const t = window.prompt("该服务开启了访问口令，请输入：");
      if (!t) throw new Error("需要访问口令");
      try { localStorage.setItem(LS_TOKEN, t); } catch (e) { /* 隐私模式忽略 */ }
      return api(path, opts, false);
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.errmsg || `HTTP ${r.status}`);
    return j;
  }

  function renderPreview() {
    $("#pushPreview").textContent = SC.buildDayMessage(new Date()).markdown.content;
    const st = pushCfg.state;
    if (!st?.lastSentDate) setStatus("尚未推送过");
    else if (st.lastResult?.ok) setStatus(`上次推送 ${st.lastSentDate}，成功 ${st.lastResult.count} 节课`, "ok");
    else if (st.lastResult?.skipped) setStatus(`上次 ${st.lastSentDate} 已跳过：${st.lastResult.errmsg}`);
    else setStatus(`上次推送 ${st.lastSentDate} 失败：${st.lastResult?.errmsg || "未知原因"}`, "err");
  }

  async function loadPushConfig() {
    try {
      pushCfg = { ...pushCfg, ...(await api("/api/config")) };
      backend = true;
      $("#connState").textContent = "本地服务已连接";
      $("#connState").className = "conn ok";
    } catch (e) {
      backend = false;
      try {
        const local = JSON.parse(localStorage.getItem(LS_PUSH) || "{}");
        pushCfg = { ...pushCfg, ...local, webhookSet: WEBHOOK_RE.test(local.webhook || "") };
      } catch (e2) { /* 首次使用 */ }
      $("#connState").textContent = "本地服务未连接";
      $("#connState").className = "conn off";
    }
    fillForm();
    renderPill();
    renderPreview();
  }

  async function savePush() {
    const form = readForm();
    if (form.webhook && !WEBHOOK_RE.test(form.webhook)) {
      setStatus("Webhook 地址格式不正确，应形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=…", "err");
      return;
    }
    if (form.enabled && !form.webhook && !pushCfg.webhookSet) {
      setStatus("请先填写有效的 Webhook 地址再启用", "err");
      return;
    }
    if (backend) {
      try {
        pushCfg = { ...pushCfg, ...(await api("/api/config", { method: "PUT", body: JSON.stringify(form) })) };
        setStatus(`已保存 · 每天 ${pushCfg.time} 推送${pushCfg.enabled ? "" : "（当前未启用）"}`, "ok");
      } catch (e) { setStatus("保存失败：" + e.message, "err"); return; }
    } else {
      pushCfg = { ...pushCfg, ...form, webhookSet: form.webhook ? true : pushCfg.webhookSet };
      try { localStorage.setItem(LS_PUSH, JSON.stringify(form)); } catch (e) { /* 隐私模式忽略 */ }
      setStatus("仅保存在本浏览器。定时推送需要运行 node server.js 后重新打开页面。", "err");
    }
    renderPill();
  }

  async function clearWebhook() {
    if (!backend) return;
    if (!window.confirm("确定清除已保存的 Webhook？清除后需要重新填写。")) return;
    try {
      pushCfg = { ...pushCfg, ...(await api("/api/config", { method: "PUT", body: JSON.stringify({ webhook: null }) })) };
      fillForm();
      renderPill();
      setStatus("已清除 Webhook", "ok");
    } catch (e) { setStatus("清除失败：" + e.message, "err"); }
  }

  function guardBackend() {
    if (backend) return true;
    setStatus("需要先在项目目录运行 node server.js，浏览器无法直接调用企业微信接口（跨域限制）", "err");
    return false;
  }

  async function pushNow(mode) {
    if (!guardBackend()) return;
    const btn = mode === "test" ? $("#btnTest") : $("#btnSend");
    btn.disabled = true;
    setStatus(mode === "test" ? "正在发送测试消息…" : "正在推送今日课表…");
    try {
      if (mode === "test") {
        const hook = $("#cfWebhook").value.trim();
        if (!hook && !pushCfg.webhookSet) throw new Error("请先填写 Webhook 地址");
        const body = hook ? { mode: "test", webhook: hook } : { mode: "test" };
        const r = await api("/api/push", { method: "POST", body: JSON.stringify(body) });
        setStatus(r.ok ? "✅ 测试消息已送达，请到群里查看" : `❌ 企业微信返回：${r.errcode} ${r.errmsg}`, r.ok ? "ok" : "err");
      } else {
        const r = await api("/api/push", { method: "POST", body: JSON.stringify({ mode: "send", force: true }) });
        setStatus(
          r.skipped ? `已跳过：${r.reason}`
            : r.ok ? `✅ 已推送今日课表（${r.count} 节课）`
            : `❌ 企业微信返回：${r.errcode} ${r.errmsg}`,
          r.ok ? "ok" : r.skipped ? "" : "err"
        );
      }
    } catch (e) {
      setStatus("❌ " + e.message, "err");
    } finally {
      btn.disabled = false;
    }
  }

  function openSettings() {
    $("#settingsModal").hidden = false;
    document.body.style.overflow = "hidden";
    loadPushConfig();
  }
  function closeSettings() {
    $("#settingsModal").hidden = true;
    document.body.style.overflow = "";
  }

  /* ---------------- 启动 ---------------- */
  renderStatic();
  renderPills();
  renderTimetable();
  renderList();
  renderCourses();
  renderStatusStrip();
  renderNext();
  renderClock();
  setView(window.matchMedia("(max-width: 700px)").matches ? "list" : "grid");

  try {
    const saved = localStorage.getItem("haust-timetable-theme");
    if (saved) applyTheme(saved);
  } catch (e) { /* 隐私模式忽略 */ }

  $("#prevWeek").onclick = () => setWeek(viewWeek - 1);
  $("#nextWeek").onclick = () => setWeek(viewWeek + 1);
  $("#thisWeekBtn").onclick = () => setWeek(weekOf(new Date()));
  $("#themeBtn").onclick = () =>
    applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  document.querySelectorAll(".seg-btn").forEach((b) => (b.onclick = () => setView(b.dataset.view)));
  $("#modal").addEventListener("click", (e) => { if (e.target.dataset.close != null) closeModal(); });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeModal();
    closeSettings();
  });

  $("#settingsBtn").onclick = openSettings;
  $("#pushPill").onclick = openSettings;
  $("#btnSave").onclick = savePush;
  $("#btnTest").onclick = () => pushNow("test");
  $("#btnSend").onclick = () => pushNow("send");
  $("#btnPreview").onclick = renderPreview;
  $("#cfClear").onclick = clearWebhook;
  $("#btnReveal").onclick = (e) => {
    const i = $("#cfWebhook");
    const shown = i.type === "text";
    i.type = shown ? "password" : "text";
    e.target.textContent = shown ? "显示" : "隐藏";
  };
  $("#settingsModal").addEventListener("click", (e) => {
    if (e.target.dataset.closeSettings != null) closeSettings();
  });
  renderPill();

  setInterval(() => {
    renderClock();
    renderNext();
  }, 1000);
  setInterval(renderTimetable, 60000);
})();
