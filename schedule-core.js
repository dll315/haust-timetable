/* 课表纯逻辑：浏览器与 Node 推送共用，保证两边算出的周次、节次时间完全一致。 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.ScheduleCore = factory();
})(typeof self !== "undefined" ? self : globalThis, function () {
  "use strict";

  const DAY_MS = 864e5;
  const DAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
  const pad = (n) => String(n).padStart(2, "0");

  function create(S) {
    const courses = new Map(S.courses.map((c) => [c.id, c]));

    function parseWeeks(str) {
      const set = new Set();
      String(str).split(",").forEach((part) => {
        const p = part.trim();
        if (!p) return;
        const range = p.match(/^(\d+)-(\d+)$/);
        if (range) {
          for (let i = +range[1]; i <= +range[2]; i++) set.add(i);
        } else if (/^\d+$/.test(p)) {
          set.add(+p);
        }
      });
      return [...set].sort((a, b) => a - b);
    }

    const sessions = S.sessions.map((s, i) => ({ ...s, idx: i, weekList: parseWeeks(s.weeks) }));
    const TOTAL_WEEKS = S.semester.totalWeeks;
    const week1 = new Date(S.semester.week1Monday + "T00:00:00");

    const dateOf = (week, dayIdx) => new Date(week1.getTime() + ((week - 1) * 7 + (dayIdx - 1)) * DAY_MS);
    const weekdayOf = (d) => (d.getDay() === 0 ? 7 : d.getDay());
    const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

    function weekOf(d) {
      return Math.floor((midnight(d) - week1.getTime()) / DAY_MS / 7) + 1;
    }
    const fmtMD = (d) => `${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
    const fmtCN = (d) => `${d.getMonth() + 1}月${d.getDate()}日`;
    const toMins = (hhmm) => +hhmm.slice(0, 2) * 60 + +hhmm.slice(3, 5);

    function bellFor(d) {
      const v = (d.getMonth() + 1) * 100 + d.getDate();
      return (
        S.bellSets.find((b) => {
          const f = b.from[0] * 100 + b.from[1];
          const t = b.to[0] * 100 + b.to[1];
          return f <= t ? v >= f && v <= t : v >= f || v <= t;
        }) || S.bellSets[0]
      );
    }

    const slotTime = (bell, start, end) => [toMins(bell.periods[start - 1][0]), toMins(bell.periods[end - 1][1])];
    const slotLabel = (bell, start, end) => `${bell.periods[start - 1][0]}-${bell.periods[end - 1][1]}`;
    const secLabel = (start, end) => (start === end ? `第 ${start} 节` : `第 ${start}-${end} 节`);

    const sessionsOn = (week, dayIdx) =>
      sessions
        .filter((s) => s.day === dayIdx && s.weekList.includes(week))
        .sort((a, b) => a.start - b.start || a.end - b.end);

    /* 某一天的完整安排 */
    function dayPlan(date) {
      const week = weekOf(date);
      const inTerm = week >= 1 && week <= TOTAL_WEEKS;
      const wd = weekdayOf(date);
      const bell = bellFor(date);
      const items = inTerm
        ? sessionsOn(week, wd).map((s) => {
            const [st, en] = slotTime(bell, s.start, s.end);
            return {
              session: s,
              course: courses.get(s.courseId),
              st,
              en,
              time: slotLabel(bell, s.start, s.end),
              sec: secLabel(s.start, s.end),
            };
          })
        : [];
      return { date, week, inTerm, weekday: wd, bell, items };
    }

    /* 距今最近的下一节课（含未来几天） */
    function findNext(now) {
      for (let off = 0; off < 8; off++) {
        const d = new Date(now.getTime() + off * DAY_MS);
        const plan = dayPlan(d);
        if (!plan.inTerm || !plan.items.length) continue;
        const cur = now.getHours() * 60 + now.getMinutes();
        for (const it of plan.items) {
          if (off > 0 || it.en > cur) {
            const base = midnight(d);
            return {
              ...it,
              date: d,
              plan,
              off,
              live: off === 0 && cur >= it.st && cur < it.en,
              startAt: base + it.st * 6e4,
              endAt: base + it.en * 6e4,
            };
          }
        }
      }
      return null;
    }

    function untilText(ms) {
      const m = Math.round(ms / 6e4);
      if (m < 60) return `${m} 分钟`;
      if (m < 1440) return `${Math.floor(m / 60)} 小时 ${m % 60} 分钟`;
      return `${Math.round(m / 1440)} 天`;
    }

    /* "2-5,7-9,11" 这类周次串压缩成可读描述 */
    function weekRangeText(list) {
      if (!list.length) return "";
      const runs = [];
      let s = list[0], p = list[0];
      for (let i = 1; i <= list.length; i++) {
        if (list[i] === p + 1) { p = list[i]; continue; }
        runs.push(s === p ? `${s}` : `${s}-${p}`);
        s = list[i]; p = list[i];
      }
      return runs.join(",");
    }

    /* 企业微信 markdown 消息：网站预览与实际推送共用同一份生成逻辑 */
    function buildDayMessage(date) {
      const plan = dayPlan(date);
      const lines = [`## 📚 ${fmtCN(date)} ${DAY_NAMES[plan.weekday - 1]} · ${plan.inTerm ? `第 ${plan.week} 周` : "非教学周"}`];

      if (!plan.inTerm) {
        lines.push(`> ${S.semester.academicYear} 学年 ${S.semester.term}，当前不在上课周次内`);
        return { markdown: { content: lines.join("\n\n") }, count: 0 };
      }
      if (!plan.items.length) {
        lines.push(`> 今天没有课，好好休息～`);
        return { markdown: { content: lines.join("\n\n") }, count: 0 };
      }

      lines.push(`> ${S.student.college} · ${S.student.major} · ${plan.bell.label}`);
      plan.items.forEach((it) => {
        lines.push(
          `**${it.time}** ｜ ${it.course.name}\n` +
          `<font color="comment">📍 ${it.session.room}</font>\n` +
          `<font color="comment">👤 ${it.session.teacher} · ${it.sec} · 第 ${weekRangeText(it.session.weekList)} 周</font>`
        );
      });

      const periods = plan.items.reduce((n, it) => n + (it.session.end - it.session.start + 1), 0);
      lines.push(
        `今日 ${plan.items.length} 节课 · 共 ${periods} 节次 · ` +
        `首节 ${plan.items[0].time.split("-")[0]} · 末节 ${plan.items[plan.items.length - 1].time.split("-")[1]}`
      );
      return { markdown: { content: lines.join("\n\n") }, count: plan.items.length };
    }

    return {
      DAY_NAMES, TOTAL_WEEKS, courses, sessions,
      parseWeeks, dateOf, weekdayOf, weekOf, midnight, fmtMD, fmtCN, toMins,
      bellFor, slotTime, slotLabel, secLabel, sessionsOn, dayPlan, findNext, untilText,
      weekRangeText, buildDayMessage,
    };
  }

  return { create };
});
