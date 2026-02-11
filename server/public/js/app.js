(() => {
  const $ = (id) => document.getElementById(id);

  // Don’t run on auth pages
  const path = window.location.pathname;
  if (path === "/login" || path === "/register") return;

  function wireDrawer() {
    const drawer = $("drawer");
    const overlay = $("overlay");
    const menuBtn = $("menuBtn");
    const closeBtn = $("closeBtn");

    if (!drawer || !menuBtn || !closeBtn) return;

    const openDrawer = () => {
      drawer.classList.add("open");
      drawer.setAttribute("aria-hidden", "false");
      menuBtn.setAttribute("aria-expanded", "true");

      if (overlay) {
        overlay.hidden = false;
        overlay.classList.add("show");
      }
    };

    const closeDrawer = () => {
      drawer.classList.remove("open");
      drawer.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");

      if (overlay) {
        overlay.classList.remove("show");
        overlay.hidden = true;
      }
    };

    menuBtn.addEventListener("click", openDrawer);
    closeBtn.addEventListener("click", closeDrawer);

    if (overlay) overlay.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });

    const logoutBtn = $("logoutBtn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async () => {
        try {
          await fetch("/api/auth/logout", { method: "POST" });
        } finally {
          window.location.href = "/login";
        }
      });
    }
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
    try { data = await res.json(); } catch {}

    if (res.ok && data?.user) {
      const name = data.user.isGuest ? "Guest" : (data.user.username || data.user.email || "User");

      if (whoami) whoami.textContent = name;
      if (drawerUser) drawerUser.textContent = name;

      if (logoutBtn) logoutBtn.style.display = "inline-flex";
      if (loginLink) loginLink.style.display = "none";
      if (registerLink) registerLink.style.display = "none";
    } else {
      if (whoami) whoami.textContent = "Guest";
      if (drawerUser) drawerUser.textContent = "Guest";

      if (logoutBtn) logoutBtn.style.display = "none";
      if (loginLink) loginLink.style.display = "inline-flex";
      if (registerLink) registerLink.style.display = "inline-flex";
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    wireDrawer();
    await loadAuthUI();
  });
})();
