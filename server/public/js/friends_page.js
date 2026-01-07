async function postJSON(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

document.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;

  const action = btn.dataset.action;

  try {
    if (action === "request") {
      await postJSON("/api/friends/request", { targetUserId: btn.dataset.userId });
      location.reload();
      return;
    }

    if (action === "accept" || action === "decline") {
      await postJSON("/api/friends/respond", {
        friendshipId: btn.dataset.friendshipId,
        action,
      });
      location.reload();
      return;
    }
  } catch (err) {
    alert(err.message || "Error occurred");
  }
});