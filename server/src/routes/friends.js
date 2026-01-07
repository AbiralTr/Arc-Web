import express from "express";
import { prisma } from "../db.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();

router.get("/friends", requireUser, async (req, res) => {
  const meId = req.userId;

  const [users, inbox, friendships] = await Promise.all([
    prisma.user.findMany({
      where: { id: { not: meId } },
      select: { id: true, username: true },
      take: 10,
      orderBy: { createdAt: "desc" },
    }),

    prisma.friendship.findMany({
      where: { addresseeId: meId, status: "PENDING" },
      include: { requester: { select: { id: true, username: true } } },
      orderBy: { createdAt: "desc" },
    }),

    prisma.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: meId }, { addresseeId: meId }],
      },
      include: {
        requester: { select: { id: true, username: true } },
        addressee: { select: { id: true, username: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  const friends = friendships.map((f) => {
    const other = f.requesterId === meId ? f.addressee : f.requester;
    return { friendshipId: f.id, user: other };
  });

  res.render("friends_page", { title: "Friends", users, inbox, friends });
});


router.post("/api/friends/request", requireUser, express.json(), async (req, res) => {
  const meId = req.userId;
  const { targetUserId } = req.body;

  if (!targetUserId) return res.status(400).json({ error: "targetUserId is required" });
  if (targetUserId === meId) return res.status(400).json({ error: "You cannot friend yourself" });
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true },
  });
  if (!target) return res.status(404).json({ error: "User not found" });

  const existing = await prisma.friendship.findFirst({
    where: {
      OR: [
        { requesterId: meId, addresseeId: targetUserId },
        { requesterId: targetUserId, addresseeId: meId },
      ],
    },
  });

  if (existing) {
    if (existing.status === "ACCEPTED") {
      return res.status(409).json({ error: "Already friends" });
    }
    if (existing.status === "PENDING") {
      return res.status(409).json({ error: "Friend request already exists" });
    }
    if (existing.status === "BLOCKED") {
      return res.status(403).json({ error: "Cannot send request" });
    }
    const updated = await prisma.friendship.update({
      where: { id: existing.id },
      data: { requesterId: meId, addresseeId: targetUserId, status: "PENDING" },
    });
    return res.json({ ok: true, friendshipId: updated.id });
  }

  const friendship = await prisma.friendship.create({
    data: {
      requesterId: meId,
      addresseeId: targetUserId,
      status: "PENDING",
    },
  });

  res.json({ ok: true, friendshipId: friendship.id });
});

router.post("/api/friends/respond", requireUser, express.json(), async (req, res) => {
  const meId = req.userId;
  const { friendshipId, action } = req.body;

  if (!friendshipId) return res.status(400).json({ error: "friendshipId is required" });
  if (!["accept", "decline"].includes(action)) {
    return res.status(400).json({ error: "action must be accept or decline" });
  }

  const friendship = await prisma.friendship.findUnique({ where: { id: friendshipId } });
  if (!friendship) return res.status(404).json({ error: "Request not found" });

  if (friendship.addresseeId !== meId) return res.status(403).json({ error: "Not allowed" });
  if (friendship.status !== "PENDING") return res.status(409).json({ error: "Request is not pending" });

  const status = action === "accept" ? "ACCEPTED" : "DECLINED";

  await prisma.friendship.update({
    where: { id: friendshipId },
    data: { status },
  });

  res.json({ ok: true });
});

export default router;