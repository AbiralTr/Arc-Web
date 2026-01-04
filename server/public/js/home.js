(() => {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function setText(id, value) {
    const el = $(id);
    if (el) el.textContent = value;
  }

  const MAX_STAT = 100;

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function radarPoints(svg, stats, maxStat = MAX_STAT) {
    const vb = svg.viewBox?.baseVal;
    const cx = vb ? (vb.x + vb.width / 2) : 100;
    const cy = vb ? (vb.y + vb.height / 2) : 100;
    const rMax = vb ? (Math.min(vb.width, vb.height) * 0.35) : 70;

    const values = [stats.str, stats.int, stats.end, stats.cha, stats.wis]
      .map(v => clamp(Number(v ?? 0), 0, maxStat) / maxStat);

    const count = values.length;
    const startAngle = -Math.PI / 2;

    return values.map((t, i) => {
      const angle = startAngle + (i * 2 * Math.PI) / count;
      const r = t * rMax;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  async function loadChangelog() {
    const el = document.getElementById("changelogBody");
    if (!el) return;

    try {
      const res = await fetch("../text/changelog.txt");
      if (!res.ok) throw new Error("Failed to load changelog");

      const text = await res.text();
      el.textContent = text; 
    } catch (err) {
      el.textContent = "Unable to load changelog.";
    }
  }


  function updateRadar(user) {
    const poly = document.getElementById("valuePoly");
    if (!poly) return;

    const svg = poly.ownerSVGElement;
    if (!svg) return;

    poly.setAttribute("points", radarPoints(svg, user));
  }


  function setXpUI(user) {
    const fill = document.getElementById("xpFill");
    const meta = document.getElementById("xpMeta");
    const bar = document.querySelector(".xp-bar");

    if (!fill || !meta || !bar) return;

    const cur = Number(user.xp ?? 0);
    const need = Number(user.xpToNext ?? 0);
    const pct = need > 0 ? Math.max(0, Math.min(100, (cur / need) * 100)) : 0;

    fill.style.width = `${pct}%`;
    meta.textContent = `Level ${user.level} · ${cur} / ${need} XP`;

    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    bar.setAttribute("aria-valuemax", "100");
  }

  function setStatUI(user) {
    setText("s_str", user.str); setText("s_int", user.int); setText("s_end", user.end); setText("s_cha", user.cha); setText("s_wis", user.wis);
    setText("statSTR", user.str); setText("statINT", user.int); setText("statEND", user.end); setText("statCHA", user.cha); setText("statWIS", user.wis);
    updateRadar(user);
  }

  async function loadStats() {
    let res;
    try {
      res = await fetch("/api/user/me");
    } catch {
      return;
    }
    if (!res.ok) return;

    const data = await res.json();
    const user = data.user;
    if (!user) return;

    setStatUI(user);
    setXpUI(user);
  }

  function renderQuestCard(q) {
    const questCardArea = $("questCardArea");
    const questPanelSub = $("questPanelSub");
    if (!questCardArea || !questPanelSub) return;

    const title = escapeHtml(q.title);
    const desc = escapeHtml(q.description);
    const stat = escapeHtml(q.stat);

    questPanelSub.textContent = `${stat.toUpperCase()} quest · Difficulty ${q.difficulty}`;

    questCardArea.innerHTML = `
      <div class="qcard">
        <div class="qcard-title">${title}</div>
        <div class="qcard-meta">${stat.toUpperCase()} · Difficulty ${q.difficulty} · ${q.xpReward} XP</div>

        <div class="qcard-desc">${desc}</div>
        <div class="qcard-actions">
          <button class="qbtn" id="completeQuestBtn" data-id="${q.id}">
            Complete Quest
          </button>
          <div class="muted" id="questMsg"></div>
        </div>
      </div>
    `;

    const completeBtn = $("completeQuestBtn");
    if (!completeBtn) return;

    completeBtn.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      const questId = btn.dataset.id;
      const msg = $("questMsg");

      btn.disabled = true;
      btn.textContent = "Completing...";

      let res;
      try {
        res = await fetch(`/api/quests/${questId}/complete`, { method: "POST" });
      } catch {
        btn.disabled = false;
        btn.textContent = "Complete Quest";
        if (msg) msg.textContent = "Network error talking to server";
        return;
      }

      const text = await res.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        btn.disabled = false;
        btn.textContent = "Complete Quest";
        if (msg) msg.textContent = data.error || `Error ${res.status}`;
        return;
      }

      if (msg) msg.textContent = `Completed! +${data.gainedXp} XP, +1 ${String(data.stat).toUpperCase()}`;

      if (data.user) {
        setStatUI(data.user);
        updateRadar(data.user);
      }
      await loadStats();

      btn.textContent = "Completed";
    });
  }

  async function generateQuestFor(stat) {
    const questOut = $("questOut");
    const buttons = document.querySelectorAll(".stat-plus");
    buttons.forEach(b => b.disabled = true);

    let res;
    try {
      res = await fetch("/api/quests/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stat })
      });
    } catch {
      if (questOut) questOut.textContent = "Network error talking to server";
      buttons.forEach(b => b.disabled = false);
      return;
    }

    const text = await res.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    buttons.forEach(b => b.disabled = false);

    if (!res.ok) {
      if (questOut) {
        questOut.textContent =
          (data.error || `Error ${res.status}`) +
          (data.raw ? `: ${String(data.raw).slice(0, 120)}` : "");
      }
      return;
    }

    renderQuestCard(data.quest);
  }

  async function loadAuthUI() {
    const whoami = $("whoami");
    const drawerUser = $("drawerUser");
    const logoutBtn = $("logoutBtn");
    const loginLink = $("loginLink");
    const registerLink = $("registerLink");

    let res;
    try {
      res = await fetch("/api/auth/me");
    } catch {
      if (whoami) whoami.textContent = "Guest";
      return;
    }

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (res.ok && data?.user) {
      const name = data.user.username || data.user.email;
      if (whoami) whoami.textContent = name;
      if (drawerUser) drawerUser.textContent = name;
      if (logoutBtn) logoutBtn.style.display = "inline-block";
      if (loginLink) loginLink.style.display = "none";
      if (registerLink) registerLink.style.display = "none";
    } else {
      if (whoami) whoami.textContent = "Guest";
    }
  }

  function wireDrawer() {
    const drawer = $("drawer");
    const backdrop = $("backdrop");
    const menuBtn = $("menuBtn");
    const closeBtn = $("closeBtn");

    const openDrawer = () => {
      if (drawer) drawer.classList.add("open");
      if (backdrop) backdrop.classList.add("show");
    };
    const closeDrawer = () => {
      if (drawer) drawer.classList.remove("open");
      if (backdrop) backdrop.classList.remove("show");
    };

    if (menuBtn) menuBtn.addEventListener("click", openDrawer);
    if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
    if (backdrop) backdrop.addEventListener("click", closeDrawer);

    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        window.location.href = "/login";
      });
    }
  }

  function wireStatButtons() {
    document.querySelectorAll(".stat-plus").forEach(btn => {
      btn.addEventListener("click", () => generateQuestFor(btn.dataset.stat));
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wireDrawer();
    wireStatButtons();
    loadChangelog();
    await loadAuthUI();
    await loadStats();
  });

  

})();
