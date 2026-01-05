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