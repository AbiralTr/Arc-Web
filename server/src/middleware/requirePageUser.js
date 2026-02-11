import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

function setAuthCookie(res, userId) {
  const token = jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
  res.cookie("arc_token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function requirePageUser(req, res, next) {
  const token = req.cookies?.arc_token;

  if (!token) {
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const guest = await prisma.user.create({
      data: { isGuest: true, guestExpiresAt: expiresAt },
      select: { id: true },
    });

    setAuthCookie(res, guest.id);
    req.userId = guest.id;
    return next();
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch {
    res.clearCookie("arc_token");
    return res.redirect("/login");
  }
}
