import express from "express";
import { prisma } from "../db.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();

export function xpToNextLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}


router.get("/me", requireUser, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
      id: true,
      email: true,
      username: true,
      level: true,
      xp: true,
      str: true,
      int: true,
      end: true,
      cha: true,
      wis: true,
    },
  });

  if (!user) return res.status(401).json({ error: "Not logged in" });

  const xpToNext = xpToNextLevel(user.level);

  return res.json({ user: { ...user, xpToNext } });
});


export default router;
