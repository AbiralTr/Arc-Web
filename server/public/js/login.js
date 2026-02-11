document.getElementById("login").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());

    const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById("msg").textContent =
        res.ok ? "Logged in! Redirecting..." : (data.error || "Error");

    if (res.ok) window.location = "/home";
});

const guestBtn = document.getElementById("guestBtn");
if (guestBtn) {
  guestBtn.addEventListener("click", async () => {
    guestBtn.disabled = true;
    document.getElementById("msg").textContent = "Creating guest session...";

    const res = await fetch("/api/auth/guest", { method: "POST" });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      guestBtn.disabled = false;
      document.getElementById("msg").textContent = data.error || "Could not create guest";
      return;
    }

    window.location.href = "/home";
  });
}