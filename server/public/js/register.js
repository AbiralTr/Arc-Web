document.getElementById("register").addEventListener("submit", async (e) => {
    e.preventDefault();

    const form = new FormData(e.target);
    const payload = Object.fromEntries(form.entries());

    if (payload.password !== payload.confirmPassword) {
        document.getElementById("msg").textContent = "Passwords do not match";
        return;
    }

    delete payload.confirmPassword;

    const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await res.json();
    document.getElementById("msg").textContent =
        res.ok
        ? "Account created! Redirecting..."
        : (data.error || "Something went wrong");

    if (res.ok) {
        setTimeout(() => {
        window.location.href = "/home";
        }, 600);
    }
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
