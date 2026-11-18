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
    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  }

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
      const a = byId(m.activityId);
      const body = `Leaving soon. Grab your ${a.gear[0] ? a.gear[0].toLowerCase() : a.name.toLowerCase()} ${a.emoji}`;
      try {
        if ("Notification" in window && Notification.permission === "granted") new Notification("Unplugged", { body });
      } catch { /* ignore */ }
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
        ? `<span class="pill">✓ Packed</span>`
        : m.status === "active" ? `<span class="pill">● Unplugged now</span>` : "";
      const actions = m.status === "planned"
        ? `<button class="btn primary grow" data-act="checklist">Did you grab it?</button>`
        : m.status === "packed"
          ? `<button class="btn primary grow" data-act="start">I'm here. Start</button>`
          : `<button class="btn primary grow" data-act="resume">Back to my moment</button>`;
      card = `
        <article class="card">
          <div class="row" style="justify-content:space-between;align-items:center">
            <p class="eyebrow" style="margin:0">Next moment</p>${status}
          </div>
          <p class="next-title">${s.emoji} ${title}${esc(when)}</p>
          <p class="muted small">${m.minutes} minutes, phone-free</p>
          <div class="bring">
            <div class="emoji" aria-hidden="true">${a.emoji}</div>
            <div><p class="small muted">Bring</p><p><b>${esc(a.gear.length ? a.gear.join(" + ") : "Just you")}</b></p></div>
          </div>
          <p class="plan-quote">“${esc(m.plan)}”</p>
          <div class="card-actions">
            ${actions}
            <button class="btn ghost" data-act="cancel" aria-label="Remove this moment">Remove</button>
          </div>
        </article>`;
    } else {
      card = `
        <article class="card empty">
          <p class="eyebrow">Next moment</p>
          <p class="next-title" style="font-size:22px">Nothing planned yet</p>
          <p class="muted small" style="margin-top:6px">Going somewhere you'll wait? Plan what you'll bring instead of your phone.</p>
        </article>`;
    }

    const recent = done.slice(-3).reverse().map((x) => {
      const a = byId(x.activityId);
      return `<div class="recent-item"><span class="e">${a.emoji}</span><span>${esc(x.place || SITUATIONS[x.situation].label)} · ${x.minutesSpent}m</span><span style="margin-left:auto">${x.mood || ""}</span></div>`;
    }).join("");

    return `
      <div class="brand"><span class="dot"></span>Unplugged</div>
      <h1>${greeting()}.<br><span class="muted">Ready to unplug?</span></h1>
      ${card}
      ${m ? "" : `<button class="btn primary block" data-act="plan">Plan a moment +</button>`}
      <div class="totals">
        <div class="stat"><b>${done.length}</b><span>unplugged moments</span></div>
        <div class="stat"><b>${fmtMinutes(totalMin)}</b><span>phone-free</span></div>
      </div>
      ${recent ? `<div><p class="eyebrow">Recently</p><div class="recent">${recent}</div></div>` : ""}
      <div class="spacer"></div>
      <p class="muted small" style="text-align:center">Everything stays on this device.</p>`;
  }

  function checklist() {
    const m = current();
    if (!m) return home();
    const a = byId(m.activityId);
    const items = [...a.gear, "Phone on silent, tucked away"];
    m.packedItems = m.packedItems || [];
    const all = items.every((_, i) => m.packedItems.includes(i));
    return `
      <div class="topbar"><button class="back" data-act="home">‹ Back</button></div>
      <div>
        <p class="eyebrow">Before you go</p>
        <h1>Did you grab it?</h1>
        <p class="muted" style="margin-top:8px">“${esc(m.plan)}”</p>
      </div>
      <div class="checklist">
        ${items.map((it, i) => {
          const on = m.packedItems.includes(i);
          return `<button class="check" data-act="toggle" data-i="${i}" aria-pressed="${on}"><span class="box"></span><span class="txt">${esc(it)}</span></button>`;
        }).join("")}
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="packed" ${all ? "" : "disabled"}>${all ? "All set. Let's go" : "Tick everything off"}</button>`;
  }

  function active() {
    const m = current();
    if (!m) return home();
    const a = byId(m.activityId);
    return `
      <div class="topbar"><span class="brand"><span class="dot"></span>Unplugged now</span></div>
      <p class="big-quote">“${esc(m.plan)}”</p>
      <div class="timer-wrap">
        <div class="ring">
          <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
            <circle class="track" cx="120" cy="120" r="108" fill="none" stroke-width="10"/>
            <circle class="prog" id="prog" cx="120" cy="120" r="108" fill="none" stroke-width="10" stroke-linecap="round"
              stroke-dasharray="${2 * Math.PI * 108}" stroke-dashoffset="${2 * Math.PI * 108}"/>
          </svg>
          <div class="center"><div><div class="time" id="time">0:00</div><div class="of">of ${m.minutes} min</div></div></div>
        </div>
      </div>
      <p class="micro">${a.emoji} ${esc(a.micro)}</p>
      <div class="spacer"></div>
      <p class="muted small" style="text-align:center">Put the phone away. Come back when you're done.</p>
      <button class="btn primary block" data-act="finish">I'm done</button>`;
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
      <div class="topbar"><button class="back" data-act="resume">‹ Back</button></div>
      <div><p class="eyebrow">Reflect</p><h1>What did you do?</h1></div>
      <div class="options">
        ${opt("plan", a.emoji, a.name, "Did what I planned")}
        ${opt("other", "🌿", "Something else offline", "Still counts")}
        ${opt("phone", "📱", "Ended up on my phone", "That's okay")}
      </div>
      <div class="field" style="margin-top:0"><span class="label">How did it feel?</span>
        <div class="moods">${mood("😌", "Calm")}${mood("😐", "Okay")}${mood("😣", "Hard")}</div>
      </div>
      <div class="row">
        <div style="flex:0 0 120px"><span class="label">Minutes</span><input type="number" id="mins" inputmode="numeric" min="1" max="600" value="${d.minutes}"></div>
        <div class="grow"><span class="label">Note (optional)</span><input type="text" id="note" maxlength="140" placeholder="Finished a chapter!" value="${esc(d.note)}"></div>
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="saveReflect" ${d.what ? "" : "disabled"}>Save</button>`;
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
          <h1>That's okay.</h1>
          <p class="muted">Planning it is the habit. Try again next time. Your plan will be ready.</p>
        </div>
        <div class="spacer"></div>
        <button class="btn primary block" data-act="home">Done</button>`;
    }
    return `
      <div class="celebrate">
        <div class="badge">✨</div>
        <h1>${r.minutes} minutes,<br>unplugged.</h1>
        <p class="muted">That's moment #${done.length}. ${fmtMinutes(totalMin)} phone-free so far.</p>
      </div>
      <div class="spacer"></div>
      <button class="btn primary block" data-act="home">Done</button>`;
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
      <div class="topbar"><h2 id="sheet-title">Plan a moment</h2><button class="btn ghost" data-act="closePlan">Cancel</button></div>
      <div class="field"><span class="label">Where are you going?</span>
        <div class="chips">${Object.entries(SITUATIONS).map(([k, s]) =>
          `<button class="chip" data-act="sit" data-v="${k}" aria-pressed="${draft.situation === k}">${s.emoji} ${s.label}</button>`).join("")}</div>
      </div>
      <div class="field"><span class="label">How long, roughly?</span>
        <div class="chips">${DURATIONS.map((d) =>
          `<button class="chip" data-act="dur" data-v="${d}" aria-pressed="${draft.minutes === d}">${d === 60 ? "1 hr+" : d + " min"}</button>`).join("")}</div>
      </div>
      <div class="field row">
        <div class="grow"><span class="label">Name it (optional)</span><input type="text" id="place" maxlength="40" placeholder="${SITUATIONS[draft.situation].place}" value="${esc(draft.place)}"></div>
        <div style="flex:0 0 130px"><span class="label">Leaving at</span><input type="time" id="leaveAt" value="${esc(draft.leaveAt)}"></div>
      </div>
      ${"Notification" in window ? `<label class="toggle"><input type="checkbox" id="remind" ${draft.remind ? "checked" : ""}> Remind me 10 min before I leave</label>` : ""}
      <div class="field"><span class="label">Bring this instead of scrolling</span>
        <div class="options">${ranked.slice(0, 4).map((a, i) => `
          <button class="option" data-act="pick" data-v="${a.id}" aria-pressed="${draft.activityId === a.id}">
            <span class="emoji">${a.emoji}</span>
            <span><span class="t">${a.name}</span><br><span class="s">${esc(a.micro)}</span></span>
            ${i === 0 ? `<span class="best">Best fit</span>` : ""}
          </button>`).join("")}</div>
      </div>
      <div class="field"><span class="label">Your if-then plan</span>
        <textarea id="plan" rows="2" maxlength="160">${esc(draft.plan)}</textarea>
        <p class="muted small" style="margin-top:6px">Saying exactly when and what makes you far more likely to do it.</p>
      </div>
      <div class="field"><button class="btn primary block" data-act="savePlan">Save my plan</button></div>`;
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
      case "packed": m.status = "packed"; save(); go("home"); break;
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
        if (d.what === "phone") {
          m.status = "tried";
        } else {
          m.status = "done";
          m.minutesSpent = d.minutes;
        }
        Object.assign(m, { outcome: d.what, mood: d.mood, note: d.note.trim(), endedAt: Date.now() });
        lastResult = { what: d.what, minutes: d.minutes };
        reflectDraft = null;
        save(); go("celebrate"); break;
      }
    }
  });

  // Restore an in-progress moment after reload.
  const cur = current();
  if (cur && cur.status === "active") view = "active";
  render();
  scheduleReminder();
})();
