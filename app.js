/* Unplugged — plan a phone-free moment, remember to bring something better. */
(() => {
  "use strict";

  // ---------- Data ----------
  const SITUATIONS = {
    transit:     { label: "Transit",          emoji: "🚆", place: "e.g. Train to work" },
    appointment: { label: "Appointment",      emoji: "🩺", place: "e.g. Dentist" },
    friend:      { label: "Meeting a friend", emoji: "☕", place: "e.g. Coffee with Sam" },
    waiting:     { label: "Waiting",          emoji: "⏳", place: "e.g. Pickup line" },
  };
  const DURATIONS = [10, 20, 30, 60];

  const ACTIVITIES = [
    { id: "magazine", emoji: "📰", name: "Magazine", action: "flip through my magazine", minMins: 5,
      situations: ["transit", "appointment", "waiting", "friend"], gear: ["Magazine"], micro: "Just one article." },
    { id: "book", emoji: "📖", name: "Book", action: "read my book", minMins: 15,
      situations: ["transit", "appointment", "waiting"], gear: ["Book", "Bookmark"], micro: "Just read one page." },
    { id: "knitting", emoji: "🧶", name: "Knitting", action: "knit a few rows", minMins: 15,
      situations: ["transit", "waiting", "appointment"], gear: ["Yarn & needles", "Project bag"], micro: "Just one row." },
    { id: "sketch", emoji: "✏️", name: "Sketchbook", action: "sketch what I see", minMins: 10,
      situations: ["transit", "appointment", "waiting", "friend"], gear: ["Sketchbook", "Pencil"], micro: "Draw one thing in front of you." },
    { id: "journal", emoji: "📓", name: "Journal", action: "write in my journal", minMins: 10,
      situations: ["transit", "appointment", "waiting", "friend"], gear: ["Journal", "Pen"], micro: "Write one sentence about today." },
    { id: "puzzle", emoji: "🧩", name: "Puzzle book", action: "do a crossword", minMins: 10,
      situations: ["transit", "appointment", "waiting"], gear: ["Puzzle book", "Pen"], micro: "Solve one clue." },
    { id: "notice", emoji: "👀", name: "Just look around", action: "look around and notice things", minMins: 5,
      situations: ["transit", "appointment", "waiting", "friend"], gear: [], micro: "Notice three things you can hear." },
  ];
  const byId = (id) => ACTIVITIES.find((a) => a.id === id) || ACTIVITIES[0];

  // ---------- Storage (fails safe) ----------
  const KEY = "unplugged.moments";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  };
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(moments)); } catch { /* private mode: keep in memory */ }
  };
  let moments = load();

  // ---------- Helpers ----------
  const $app = document.getElementById("app");
  const $sheet = document.getElementById("sheet");
  const $backdrop = document.getElementById("sheet-backdrop");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const current = () => moments.find((m) => m.status === "planned" || m.status === "packed" || m.status === "active");
  const completed = () => moments.filter((m) => m.status === "done");

  function fmtTime(hhmm) {
    if (!hhmm) return "";
    const [h, m] = hhmm.split(":").map(Number);
    const ap = h >= 12 ? "pm" : "am";
    const h12 = h % 12 || 12;
    return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
  }
  function fmtMinutes(total) {
    if (total < 60) return `${total}m`;
    const h = Math.floor(total / 60), m = total % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  function greeting() {
    const h = new Date().getHours();
    return h < 12 ? "good morning ☀️" : h < 18 ? "hey, good afternoon ✨" : "good evening 🌙";
  }

  // ---------- Celebration: confetti ----------
  const $confetti = document.getElementById("confetti");
  const reduceMotion = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function confetti(count = 70) {
    if (reduceMotion()) return;
    const colors = ["#9b7bff", "#ff8fcf", "#7cc8ff", "#ffd36e", "#8ef0c8", "#c9b8ff"];
    let html = "";
    for (let i = 0; i < count; i++) {
      const left = Math.random() * 100;
      const x = (Math.random() - 0.5) * 220;
      const r = 360 + Math.random() * 720;
      const d = 1.8 + Math.random() * 1.6;
      const delay = Math.random() * 0.35;
      const c = colors[i % colors.length];
      const round = Math.random() > 0.6 ? "border-radius:50%;width:9px;height:9px;" : "";
      html += `<i style="left:${left}%;background:${c};${round}--x:${x}px;--r:${r}deg;--d:${d}s;--delay:${delay}s"></i>`;
    }
    $confetti.innerHTML = html;
    clearTimeout(confetti.t);
    confetti.t = setTimeout(() => { $confetti.innerHTML = ""; }, 4000);
  }

  // ---------- Milestone badges (only ever earned, never lost) ----------
  const MILESTONES = [
    { id: "first", emoji: "🌱", name: "first moment", test: (d) => d.length >= 1 },
    { id: "hour", emoji: "⏳", name: "1 hour unplugged", test: (d) => mins(d) >= 60 },
    { id: "five", emoji: "🖐️", name: "5 moments", test: (d) => d.length >= 5 },
    { id: "variety", emoji: "🎨", name: "3 different activities", test: (d) => new Set(d.map((x) => x.activityId)).size >= 3 },
    { id: "ten", emoji: "🌸", name: "10 moments", test: (d) => d.length >= 10 },
  ];
  const mins = (d) => d.reduce((s, x) => s + (x.minutesSpent || 0), 0);
  const earned = (d) => MILESTONES.filter((b) => b.test(d)).map((b) => b.id);

  // ---------- Notification banner (in-app, iOS-style) ----------
  const $notif = document.getElementById("notif");
  function bestieText(m) {
    const a = byId(m.activityId);
    const thing = a.gear[0] ? a.gear[0].toLowerCase() : "eyes up";
    const where = m.place ? `for the ${m.place.toLowerCase()}` : "for later";
    return {
      title: "leaving in 10 👀",
      body: a.gear.length
        ? `grab your ${thing} ${a.emoji} ${where}. future you says thx ✨`
        : `no gear needed, just you ${a.emoji}. phone stays in the bag ✨`,
    };
  }
  function showNotif(m) {
    if (!m) return;
    const t = bestieText(m);
    $notif.innerHTML = `
      <span class="ic" aria-hidden="true">⏻</span>
      <span style="flex:1">
        <span class="hd"><span>UNPLUGGED</span><span>now</span></span>
        <span class="tt" style="display:block">${esc(t.title)}</span>
        <span class="bd" style="display:block">${esc(t.body)}</span>
      </span>`;
    $notif.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => $notif.classList.add("show")));
    clearTimeout(showNotif.t);
    showNotif.t = setTimeout(hideNotif, 7000);
    // Also try a real system notification where the browser allows it.
    try {
      if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
        new Notification(t.title, { body: t.body, icon: "icon.svg" });
      }
    } catch { /* ignore */ }
  }
  function hideNotif() {
    $notif.classList.remove("show");
    setTimeout(() => { if (!$notif.classList.contains("show")) $notif.hidden = true; }, 600);
  }
  $notif.addEventListener("click", () => {
    hideNotif();
    const m = current();
    if (m && m.status === "planned") go("checklist");
  });

  // Matching: +2 if it fits the situation, +1 if it fits the time; drop what needs more time than you have.
  function rank(situation, minutes) {
    return ACTIVITIES
      .filter((a) => a.minMins <= minutes)
      .map((a) => ({ a, score: (a.situations.includes(situation) ? 2 : 0) + (a.minMins <= minutes ? 1 : 0) }))
      .sort((x, y) => y.score - x.score)
      .map((x) => x.a);
  }

  function whenPhrase(situation, place) {
    const p = (place || "").trim();
    const lower = p ? p.charAt(0).toLowerCase() + p.slice(1) : "";
    switch (situation) {
      case "transit": return p ? `on the ${lower}` : "on the train or bus";
      case "appointment": return p ? `at the ${lower}` : "at my appointment";
      case "friend": return p ? `waiting for ${p}` : "waiting for my friend";
      default: return p ? `in the ${lower}` : "waiting";
    }
  }
  const planSentence = (situation, place, activity) =>
    `When I'm ${whenPhrase(situation, place)}, I'll ${activity.action}.`;

  // ---------- Reminder (best effort; never required) ----------
  let reminderTimer = null;
  function scheduleReminder() {
    clearTimeout(reminderTimer);
    const m = current();
    if (!m || !m.remind || !m.leaveAt || m.status !== "planned") return;
    const [h, mm] = m.leaveAt.split(":").map(Number);
    const at = new Date(); at.setHours(h, mm - 10, 0, 0);
    const ms = at - Date.now();
    if (ms <= 0 || ms > 12 * 3600e3) return;
    reminderTimer = setTimeout(() => {
      const t = bestieText(m);
      try {
        if ("Notification" in window && Notification.permission === "granted") new Notification(t.title, { body: t.body, icon: "icon.svg" });
      } catch { /* ignore */ }
      showNotif(m);
    }, ms);
  }

  // ---------- Views ----------
  let view = "home";
  let reflectDraft = null;
  let tick = null;

  function go(v) {
    view = v;
    clearInterval(tick);
    render();
    window.scrollTo(0, 0);
  }

  function render() {
    const views = { home, checklist, active, reflect, celebrate };
    $app.innerHTML = (views[view] || home)();
    $app.style.animation = "none"; void $app.offsetWidth; $app.style.animation = "";
    if (view === "active") startTick();
  }

  function home() {
    const m = current();
    const done = completed();
    const totalMin = done.reduce((s, x) => s + (x.minutesSpent || 0), 0);

    let card;
    if (m) {
      const a = byId(m.activityId);
      const s = SITUATIONS[m.situation];
      const title = esc(m.place || s.label);
      const when = m.leaveAt ? ` · ${fmtTime(m.leaveAt)}` : "";
      const status = m.status === "packed"
        ? `<span class="pill">✓ packed</span>`
        : m.status === "active" ? `<span class="pill">● unplugged now</span>` : `<span class="pill">✧ planned</span>`;
      const actions = m.status === "planned"
        ? `<button class="btn primary grow" data-act="checklist">did you grab it? ✧</button>`
        : m.status === "packed"
          ? `<button class="btn primary grow" data-act="start">i'm here. start ✨</button>`
          : `<button class="btn primary grow" data-act="resume">back to my moment</button>`;
      card = `
        <article class="card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <p class="eyebrow" style="margin:0">next moment</p>${status}
          </div>
          <p class="next-title">${s.emoji} ${title}${esc(when)}</p>
          <p class="muted small">${m.minutes} minutes, phone-free</p>
          <div class="bring">
            <div class="emoji" aria-hidden="true">${a.emoji}</div>
            <div><p class="small muted">bring</p><p><b>${esc(a.gear.length ? a.gear.join(" + ") : "just you")}</b></p></div>
          </div>
          <p class="plan-quote">“${esc(m.plan)}”</p>
          <div class="card-actions">
            ${actions}
            <button class="btn ghost" data-act="cancel" aria-label="Remove this moment">remove</button>
          </div>
          ${m.status === "planned" ? `<button class="linkish" data-act="previewNotif">preview my reminder 🔔</button>` : ""}
        </article>`;
    } else {
      card = `
        <article class="card empty">
          <p class="eyebrow">next moment</p>
          <p class="next-title" style="font-size:22px">nothing planned yet ☁️</p>
          <p class="muted small" style="margin-top:6px">going somewhere you'll wait? plan what you'll bring instead of your phone.</p>
        </article>`;
    }

    const got = earned(done);
    const badgeRow = `<div><p class="eyebrow">your badges</p><div class="badges">${MILESTONES.map((b) =>
      `<span class="badge-chip ${got.includes(b.id) ? "" : "locked"}">${b.emoji} ${b.name}</span>`).join("")}</div></div>`;

    const recent = done.slice(-3).reverse().map((x) => {
      const a = byId(x.activityId);
      return `<div class="recent-item"><span class="e">${a.emoji}</span><span>${esc(x.place || SITUATIONS[x.situation].label)} · ${x.minutesSpent}m</span><span style="margin-left:auto">${x.mood || ""}</span></div>`;
    }).join("");

    return `
      <div class="brand"><span class="dot"></span>Unplugged</div>
      <h1>${greeting()}<br><span class="soft">ready to unplug?</span></h1>
      ${card}
      ${m ? "" : `<button class="btn primary block" data-act="plan">plan a moment ✨</button>`}
      <div class="totals">
        <div class="stat"><b>${done.length}</b><span>unplugged moments</span></div>
        <div class="stat"><b>${fmtMinutes(totalMin)}</b><span>phone-free</span></div>
      </div>
      ${badgeRow}
      ${recent ? `<div><p class="eyebrow">recently</p><div class="recent">${recent}</div></div>` : ""}
      <div class="spacer"></div>
      <p class="footnote">everything stays on this device 🔒</p>`;
  }

  function checklist() {
    const m = current();
    if (!m) return home();
    const a = byId(m.activityId);
    const items = [...a.gear, "Phone on silent, tucked away"];
    m.packedItems = m.packedItems || [];
    const all = items.every((_, i) => m.packedItems.includes(i));
    const pct = Math.round((m.packedItems.length / items.length) * 100);
    return `
      <div class="topbar"><button class="back" data-act="home">‹ back</button></div>
      <div>
        <p class="eyebrow">before you go</p>
        <h1>did you grab it? 🎒</h1>
        <p class="muted" style="margin-top:8px">“${esc(m.plan)}”</p>
      </div>
      <div class="progress" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Packed"><i style="width:${pct}%"></i></div>
      <div class="checklist">
        ${items.map((it, i) => {
          const on = m.packedItems.includes(i);
          return `<button class="check" data-act="toggle" data-i="${i}" aria-pressed="${on}"><span class="box"></span><span class="txt">${esc(it)}</span></button>`;
        }).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="packed" ${all ? "" : "disabled"}>${all ? "all set. let's go 🚀" : "tick everything off"}</button>`;
  }

  function active() {
    const m = current();
    if (!m) return home();
    const a = byId(m.activityId);
    return `
      <div class="topbar"><span class="brand"><span class="dot"></span>unplugged now</span></div>
      <p class="big-quote">“${esc(m.plan)}”</p>
      <div class="timer-wrap">
        <div class="ring">
          <svg width="250" height="250" viewBox="-5 -5 250 250" aria-hidden="true">
            <defs><linearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9b7bff"/><stop offset="0.5" stop-color="#ff8fcf"/><stop offset="1" stop-color="#7cc8ff"/></linearGradient></defs>
            <circle class="track" cx="120" cy="120" r="108" fill="none" stroke-width="10"/>
            <circle class="prog" id="prog" cx="120" cy="120" r="108" fill="none" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 108}" stroke-dashoffset="${2 * Math.PI * 108}"/>
          </svg>
          <div class="center"><div><div class="time" id="time">0:00</div><div class="of">of ${m.minutes} min</div></div></div>
        </div>
      </div>
      <p class="micro">${a.emoji} ${esc(a.micro)}</p>
      <div class="spacer"></div>
      <p class="footnote">phone away now. come back when you're done 🌿</p>
      <button class="btn primary block" data-act="finish">i'm done ✓</button>`;
  }

  function startTick() {
    const m = current();
    if (!m || !m.startedAt) return;
    const C = 2 * Math.PI * 108;
    const update = () => {
      const secs = Math.max(0, Math.floor((Date.now() - m.startedAt) / 1000));
      const t = document.getElementById("time");
      const p = document.getElementById("prog");
      if (!t || !p) return;
      t.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
      p.style.strokeDashoffset = String(C * (1 - Math.min(1, secs / (m.minutes * 60))));
    };
    update();
    tick = setInterval(update, 1000);
  }

  function reflect() {
    const m = current();
    if (!m) return home();
    const a = byId(m.activityId);
    const d = reflectDraft;
    const opt = (val, emoji, t, s) =>
      `<button class="option" data-act="what" data-v="${val}" aria-pressed="${d.what === val}"><span class="emoji">${emoji}</span><span><span class="t">${t}</span><br><span class="s">${s}</span></span></button>`;
    const mood = (v, label) => `<button class="mood" data-act="mood" data-v="${v}" aria-pressed="${d.mood === v}">${v}<span>${label}</span></button>`;
    return `
      <div class="topbar"><button class="back" data-act="resume">‹ back</button></div>
      <div><p class="eyebrow">reflect</p><h1>what did you do? 💭</h1></div>
      <div class="options">
        ${opt("plan", a.emoji, a.name.toLowerCase(), "did what i planned")}
        ${opt("other", "🌿", "something else offline", "still counts")}
        ${opt("phone", "📱", "ended up on my phone", "that's okay")}
      </div>
      <div class="field" style="margin-top:0"><span class="label">how did it feel?</span>
        <div class="moods">${mood("😌", "calm")}${mood("😐", "okay")}${mood("😣", "hard")}</div>
      </div>
      <div class="row">
        <div style="flex:0 0 120px"><span class="label">minutes</span><input type="number" id="mins" inputmode="numeric" min="1" max="600" value="${d.minutes}"></div>
        <div class="grow"><span class="label">note (optional)</span><input type="text" id="note" maxlength="140" placeholder="finished a chapter!" value="${esc(d.note)}"></div>
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="saveReflect" ${d.what ? "" : "disabled"}>save ✨</button>`;
  }

  let lastResult = null;
  function celebrate() {
    const r = lastResult || {};
    const done = completed();
    const totalMin = done.reduce((s, x) => s + (x.minutesSpent || 0), 0);
    if (r.what === "phone") {
      return `
        <div class="celebrate">
          <div class="badge">🌱</div>
          <h1>that's okay.</h1>
          <p class="muted">planning it is the habit. try again next time, your plan will be ready 💜</p>
        </div>
        <div class="spacer"></div>
        <button class="btn primary block" data-act="home">done</button>`;
    }
    const fresh = (r.newBadges || []).map((id) => MILESTONES.find((b) => b.id === id));
    return `
      <div class="celebrate">
        <div class="badge">✨</div>
        <h1>${r.minutes} minutes,<br><span class="soft">unplugged.</span></h1>
        <p class="muted">that's moment #${done.length}. ${fmtMinutes(totalMin)} phone-free so far 🌸</p>
        ${fresh.length ? `<p class="eyebrow" style="margin-top:12px">new badge unlocked</p>
          <div class="badges new-badge" style="justify-content:center">${fresh.map((b) => `<span class="badge-chip">${b.emoji} ${b.name}</span>`).join("")}</div>` : ""}
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="home">done</button>`;
  }

  // ---------- Plan sheet ----------
  let draft = null;
  function openPlan() {
    draft = { situation: "appointment", minutes: 20, place: "", leaveAt: "", remind: false, activityId: null, plan: "", edited: false };
    renderSheet();
    $sheet.hidden = false; $backdrop.hidden = false;
    document.body.style.overflow = "hidden";
  }
  function closePlan() {
    $sheet.hidden = true; $backdrop.hidden = true;
    document.body.style.overflow = "";
  }
  function renderSheet(focusId) {
    const ranked = rank(draft.situation, draft.minutes);
    if (!ranked.some((a) => a.id === draft.activityId)) draft.activityId = ranked[0]?.id;
    const act = byId(draft.activityId);
    if (!draft.edited) draft.plan = planSentence(draft.situation, draft.place, act);

    $sheet.innerHTML = `
      <div class="grabber"></div>
      <div class="topbar"><h2 id="sheet-title">plan a moment ✨</h2><button class="btn ghost" data-act="closePlan">cancel</button></div>
      <div class="field"><span class="label">where are you going?</span>
        <div class="chips">${Object.entries(SITUATIONS).map(([k, s]) =>
          `<button class="chip" data-act="sit" data-v="${k}" aria-pressed="${draft.situation === k}">${s.emoji} ${s.label}</button>`).join("")}</div>
      </div>
      <div class="field"><span class="label">how long, roughly?</span>
        <div class="chips">${DURATIONS.map((d) =>
          `<button class="chip" data-act="dur" data-v="${d}" aria-pressed="${draft.minutes === d}">${d === 60 ? "1 hr+" : d + " min"}</button>`).join("")}</div>
      </div>
      <div class="field row">
        <div class="grow"><span class="label">name it (optional)</span><input type="text" id="place" maxlength="40" placeholder="${SITUATIONS[draft.situation].place}" value="${esc(draft.place)}"></div>
        <div style="flex:0 0 130px"><span class="label">leaving at</span><input type="time" id="leaveAt" value="${esc(draft.leaveAt)}"></div>
      </div>
      ${"Notification" in window ? `<label class="toggle"><input type="checkbox" id="remind" ${draft.remind ? "checked" : ""}> remind me 10 min before i leave 🔔</label>` : ""}
      <div class="field"><span class="label">bring this instead of scrolling</span>
        <div class="options">${ranked.slice(0, 4).map((a, i) => `
          <button class="option" data-act="pick" data-v="${a.id}" aria-pressed="${draft.activityId === a.id}">
            <span class="emoji">${a.emoji}</span>
            <span><span class="t">${a.name}</span><br><span class="s">${esc(a.micro)}</span></span>
            ${i === 0 ? `<span class="best">best fit ✧</span>` : ""}
          </button>`).join("")}</div>
      </div>
      <div class="field"><span class="label">your if-then plan</span>
        <textarea id="plan" rows="2" maxlength="160">${esc(draft.plan)}</textarea>
        <p class="muted small" style="margin-top:6px">saying exactly when + what makes you way more likely to do it 🧠</p>
      </div>
      <div class="field"><button class="btn primary block" data-act="savePlan">save my plan ✨</button></div>`;
    if (focusId) {
      const el = document.getElementById(focusId);
      if (el) { el.focus(); const v = el.value; el.value = ""; el.value = v; }
    }
  }

  $sheet.addEventListener("input", (e) => {
    if (e.target.id === "place") {
      draft.place = e.target.value;
      if (!draft.edited) { draft.plan = planSentence(draft.situation, draft.place, byId(draft.activityId)); document.getElementById("plan").value = draft.plan; }
    } else if (e.target.id === "leaveAt") draft.leaveAt = e.target.value;
    else if (e.target.id === "plan") { draft.plan = e.target.value; draft.edited = true; }
  });
  $sheet.addEventListener("change", (e) => {
    if (e.target.id === "remind") {
      draft.remind = e.target.checked;
      if (draft.remind && "Notification" in window && Notification.permission === "default") {
        try { Notification.requestPermission(); } catch { /* ignore */ }
      }
    }
  });
  $sheet.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const v = b.dataset.v;
    switch (b.dataset.act) {
      case "closePlan": closePlan(); break;
      case "sit": draft.situation = v; draft.edited = false; renderSheet(); break;
      case "dur": draft.minutes = Number(v); renderSheet(); break;
      case "pick": draft.activityId = v; draft.edited = false; renderSheet(); break;
      case "savePlan": {
        const plan = draft.plan.trim() || planSentence(draft.situation, draft.place, byId(draft.activityId));
        moments.push({
          id: uid(), situation: draft.situation, minutes: draft.minutes, place: draft.place.trim(),
          leaveAt: draft.leaveAt, remind: draft.remind, activityId: draft.activityId, plan,
          status: "planned", packedItems: [], createdAt: Date.now(),
        });
        save(); closePlan(); scheduleReminder(); go("home");
        // Demo moment: the friendly reminder slides in a few seconds after saving.
        clearTimeout(showNotif.demo);
        showNotif.demo = setTimeout(() => { const c = current(); if (c && c.status === "planned") showNotif(c); }, 2500);
        break;
      }
    }
  });
  $backdrop.addEventListener("click", closePlan);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$sheet.hidden) closePlan(); });

  // ---------- App actions ----------
  $app.addEventListener("input", (e) => {
    if (!reflectDraft) return;
    if (e.target.id === "mins") reflectDraft.minutes = Math.max(1, Math.min(600, Number(e.target.value) || 1));
    if (e.target.id === "note") reflectDraft.note = e.target.value;
  });

  $app.addEventListener("click", (e) => {
    const b = e.target.closest("[data-act]");
    if (!b) return;
    const m = current();
    const v = b.dataset.v;
    switch (b.dataset.act) {
      case "plan": openPlan(); break;
      case "home": go("home"); break;
      case "checklist": go("checklist"); break;
      case "toggle": {
        const i = Number(b.dataset.i);
        m.packedItems = m.packedItems.includes(i) ? m.packedItems.filter((x) => x !== i) : [...m.packedItems, i];
        save(); render(); break;
      }
      case "packed": m.status = "packed"; save(); go("home"); confetti(40); break;
      case "previewNotif": showNotif(m); break;
      case "start": m.status = "active"; m.startedAt = Date.now(); save(); go("active"); break;
      case "resume": go(m && m.status === "active" ? "active" : "home"); break;
      case "cancel":
        if (confirm("Remove this planned moment?")) { moments = moments.filter((x) => x !== m); save(); go("home"); }
        break;
      case "finish": {
        const elapsed = Math.round((Date.now() - m.startedAt) / 60000);
        reflectDraft = { what: null, mood: null, note: "", minutes: elapsed >= 1 ? elapsed : m.minutes };
        go("reflect"); break;
      }
      case "what": reflectDraft.what = v; render(); break;
      case "mood": reflectDraft.mood = v; render(); break;
      case "saveReflect": {
        const d = reflectDraft;
        const before = earned(completed());
        if (d.what === "phone") {
          m.status = "tried";
        } else {
          m.status = "done";
          m.minutesSpent = d.minutes;
        }
        Object.assign(m, { outcome: d.what, mood: d.mood, note: d.note.trim(), endedAt: Date.now() });
        const newBadges = earned(completed()).filter((id) => !before.includes(id));
        lastResult = { what: d.what, minutes: d.minutes, newBadges };
        reflectDraft = null;
        save(); go("celebrate");
        if (d.what !== "phone") confetti(newBadges.length ? 110 : 70);
        break;
      }
    }
  });

  // Restore an in-progress moment after reload.
  const cur = current();
  if (cur && cur.status === "active") view = "active";
  render();
  scheduleReminder();
})();
