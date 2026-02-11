import express from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { prisma } from "../db.js";

const router = express.Router();

const registerSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(8).max(72),
});

const loginSchema = z.object({
  username: z.string().min(3).max(20).regex(/^[a-zA-Z0-9_]+$/),
  password: z.string().min(1),
});

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("arc_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

function getUserIdFromCookie(req) {
  const token = req.cookies?.arc_token;
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    return payload.userId;
  } catch {
    return null;
  }
}

router.post("/register", async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { email, username, password } = parsed.data;

  const existingEmail = await prisma.user.findUnique({ where: { email } });
  if (existingEmail) return res.status(409).json({ error: "Email already in use" });

  const existingUser = await prisma.user.findUnique({ where: { username } });
  if (existingUser) return res.status(409).json({ error: "Username already in use" });

  const passwordHash = await bcrypt.hash(password, 12);

  const currentId = getUserIdFromCookie(req);

  if (currentId) {
    const current = await prisma.user.findUnique({
      where: { id: currentId },
      select: { id: true, isGuest: true },
    });

    if (current?.isGuest) {
      const upgraded = await prisma.user.update({
        where: { id: currentId },
        data: {
          email,
          username,
          passwordHash,
          isGuest: false,
          guestExpiresAt: null,
        },
        select: { id: true, email: true, username: true, createdAt: true },
      });

      setAuthCookie(res, upgraded.id);
      return res.json({ user: upgraded });
    }
  }

  const user = await prisma.user.create({
    data: { email, username, passwordHash },
    select: { id: true, email: true, username: true, createdAt: true },
  });

  setAuthCookie(res, user.id);
  return res.json({ user });
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) return res.status(401).json({ error: "Invalid credentials" });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });

  setAuthCookie(res, user.id);

  res.json({
    user: { id: user.id, email: user.email, username: user.username, createdAt: user.createdAt },
  });
});

router.post("/logout", async (req, res) => {
  res.clearCookie("arc_token");
  res.json({ ok: true });
});

router.get("/me", async (req, res) => {
  const token = req.cookies?.arc_token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, username: true, isGuest: true, guestExpiresAt: true, createdAt: true },
    });

    if (!user) return res.status(401).json({ error: "Not logged in" });
    res.json({ user });
  } catch {
    return res.status(401).json({ error: "Not logged in" });
  }
});

router.post("/guest", async (req, res) => {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const user = await prisma.user.create({
    data: {
      isGuest: true,
      guestExpiresAt: expiresAt,
    },
    select: { id: true, isGuest: true, guestExpiresAt: true, createdAt: true },
  });

  setAuthCookie(res, user.id);
  return res.json({ user });
});


export default router;
