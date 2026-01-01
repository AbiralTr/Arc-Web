import jwt from "jsonwebtoken";

export function requireUser(req, res, next) {
  const token = req.cookies?.arc_token;
  if (!token) return res.status(401).json({ error: "Not logged in" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    return res.status(401).json({ error: "Not logged in" });
  }
}
