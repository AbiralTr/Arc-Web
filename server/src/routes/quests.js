import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const statEnum = z.enum(["str", "int", "end", "cha", "wis"]);

// Level up Handling
function xpToNextLevel(level) {
  return Math.floor(100 * Math.pow(1.5, level - 1));
}

function applyLevelUps(startLevel, startXp) {
  let level = startLevel;
  let xp = startXp;

  while (xp >= xpToNextLevel(level)) {
    xp -= xpToNextLevel(level);
    level += 1;
  }

  return { level, xp };
}

// --- Model output hardening ---

function normalizeDifficulty(val) {
  if (typeof val === "number" && Number.isFinite(val)) return val;

  if (typeof val === "string") {
    const s = val.toLowerCase().trim();

    if (s.includes("very easy")) return 1;
    if (s.includes("easy")) return 2;
    if (s.includes("medium") || s.includes("moderate")) return 3;
    if (s.includes("very hard") || s.includes("extreme")) return 5;
    if (s.includes("hard")) return 4;

    // digit fallback
    const m = s.match(/[1-5]/);
    if (m) return Number(m[0]);
  }

  // last resort default
  return 2;
}

const questSchema = z
  .object({
    title: z.string().min(3).max(80),
    description: z.string().min(10).max(600),
    difficulty: z.preprocess(normalizeDifficulty, z.number().int().min(1).max(5)),
    xpReward: z.number().int().min(5).max(50),
    tags: z.array(z.string()).max(8),
  })
  .strict();

function coerceJsonObject(raw) {
  if (typeof raw !== "string") return null;

  let s = raw.trim().replace(/^\uFEFF/, ""); // strip BOM

  // unwrap ```json ... ``` or ``` ... ```
  const fenced = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) s = fenced[1].trim();

  const a = s.indexOf("{");
  const b = s.lastIndexOf("}");
  if (a === -1 || b === -1 || b < a) return null;

  s = s.slice(a, b + 1);

  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}


router.post("/generate", requireUser, async (req, res) => {
  const statParsed = statEnum.safeParse(req.body?.stat);
  if (!statParsed.success) return res.status(400).json({ error: "Invalid stat" });
  const stat = statParsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: {
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

  const prompt = [
    `Generate ONE real-world quest to improve ${stat.toUpperCase()}.`,
    `User: ${user.username}, level ${user.level}, xp ${user.xp}.`,
    `Stats: STR ${user.str}, INT ${user.int}, END ${user.end}, CHA ${user.cha}, WIS ${user.wis}.`,
    ``,
    `Constraints:`,
    `- Must take 2–8 minutes.`,
    `- No gym, no special equipment.`,
    `- Must be doable indoors OR outdoors (do not require going outside).`,
    `- Scale difficulty with the relevant stat (low stat => very easy).`,
    ``,
    `Return ONLY a JSON object with EXACT keys and types:`,
    `title (string, 1-2 words),`,
    `description (string, 1 sentence),`,
    `difficulty (integer 1-5),`,
    `xpReward (integer 5-50),`,
    `tags (array of strings).`,
    `No markdown. No backticks. No extra keys. No commentary.`,
  ].join("\n");

  let response;
  try {
    response = await client.responses.create({
      model: "gpt-4o",
      input: prompt,
      instructions:
        "Return ONLY valid JSON. difficulty must be an integer 1-5. tags must be an array of strings. No markdown.",
    });
  } catch (e) {
    return res.status(502).json({
      error: "OpenAI quest generation failed",
      detail: String(e?.message || e),
    });
  }

  const raw = response.output_text?.trim() || "";
  const questJson = coerceJsonObject(raw);

  if (!questJson) {
    return res.status(502).json({
      error: "Model returned invalid JSON",
      raw,
    });
  }

  const questParsed = questSchema.safeParse(questJson);
  if (!questParsed.success) {
    return res.status(502).json({
      error: "Model output failed validation",
      issues: questParsed.error.issues,
      raw: questJson,
    });
  }

  const q = questParsed.data;

  const saved = await prisma.quest.create({
    data: {
      userId: req.userId,
      stat,
      title: q.title,
      description: q.description,
      difficulty: q.difficulty,
      xpReward: q.xpReward,
      tags: q.tags,
    },
  });

  return res.json({ quest: saved });
});

router.post("/:id/complete", requireUser, async (req, res) => {
  const id = req.params.id;

  const quest = await prisma.quest.findFirst({
    where: { id, userId: req.userId },
  });

  if (!quest) return res.status(404).json({ error: "Quest not found" });
  if (quest.status === "completed") return res.status(400).json({ error: "Already completed" });

  const stat = quest.stat;
  const gainedXp = quest.xpReward;

  const user = await prisma.$transaction(async (tx) => {
    await tx.quest.update({
      where: { id },
      data: { status: "completed", completedAt: new Date() },
    });

    const current = await tx.user.findUnique({
      where: { id: req.userId },
      select: { level: true, xp: true },
    });

    if (!current) throw new Error("User missing");

    const combinedXp = current.xp + gainedXp;
    const leveled = applyLevelUps(current.level, combinedXp);

    return tx.user.update({
      where: { id: req.userId },
      data: {
        level: leveled.level,
        xp: leveled.xp,
        [stat]: { increment: 1 },
      },
      select: {
        level: true,
        xp: true,
        str: true,
        int: true,
        end: true,
        cha: true,
        wis: true,
      },
    });
  });

  return res.json({ ok: true, gainedXp, stat, user });
});

router.get("/activity", requireUser, async (req, res) => {
  const userId = req.userId;

  const recentCompleted = await prisma.quest.findMany({
    where: { userId, status: "completed", completedAt: { not: null } },
    orderBy: { completedAt: "desc" },
    take: 3,
    select: { id: true, title: true, stat: true, xpReward: true, completedAt: true },
  });

  return res.json({ ok: true, recentCompleted });
});



export default router;
