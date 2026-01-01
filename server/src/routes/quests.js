import express from "express";
import OpenAI from "openai";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireUser } from "../middleware/requireUser.js";
console.log("OPENAI KEY PRESENT:", !!process.env.OPENAI_API_KEY);

const router = express.Router();

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const statEnum = z.enum(["str", "int", "end", "cha", "wis"]);

router.post("/generate", requireUser, async (req, res) => {
  const statParsed = statEnum.safeParse(req.body?.stat);
  if (!statParsed.success) return res.status(400).json({ error: "Invalid stat" });

  const stat = statParsed.data;

  const user = await prisma.user.findUnique({
    where: { id: req.userId },
    select: { username: true, level: true, xp: true, str: true, int: true, end: true, cha: true, wis: true },
  });

  if (!user) return res.status(401).json({ error: "Not logged in" });

  const prompt = `
Generate ONE real-world quest for improving ${stat.toUpperCase()}.
User: ${user.username}, level ${user.level}, xp ${user.xp}.
Current stats: STR ${user.str}, INT ${user.int}, END ${user.end}, CHA ${user.cha}, WIS ${user.wis}.

Return strict JSON with keys:
title (string),
description (string, 2-4 sentences),
difficulty (integer 1-5),
xpReward (integer 5-50),
tags (array of strings).
No extra keys. No markdown.
`;

  const response = await client.responses.create({
    model: "gpt-4o",
    instructions: "You generate concise, practical RPG-style quests. Output must be strict JSON only.",
    input: prompt,
  });


  const text = response.output_text?.trim() || "";
  let questJson;
  try {
    questJson = JSON.parse(text);
  } catch {
    return res.status(502).json({ error: "Model returned invalid JSON", raw: text });
  }


  const questSchema = z.object({
    title: z.string().min(3).max(80),
    description: z.string().min(10).max(600),
    difficulty: z.number().int().min(1).max(5),
    xpReward: z.number().int().min(5).max(50),
    tags: z.array(z.string()).max(8),
  });

  const questParsed = questSchema.safeParse(questJson);
  if (!questParsed.success) {
    return res.status(502).json({ error: "Model output failed validation", issues: questParsed.error.issues, raw: questJson });
  }

  const q = questParsed.data;

  // Save to DB
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

  res.json({ quest: saved });
});

router.post("/:id/complete", requireUser, async (req, res) => {
  const id = req.params.id;

  const quest = await prisma.quest.findFirst({
    where: { id, userId: req.userId },
  });

  if (!quest) return res.status(404).json({ error: "Quest not found" });
  if (quest.status === "completed") return res.status(400).json({ error: "Already completed" });

  const stat = quest.stat; // "str" | "int" | "end" | "cha" | "wis"
  const gainedXp = quest.xpReward;

  const user = await prisma.$transaction(async (tx) => {
    await tx.quest.update({
      where: { id },
      data: { status: "completed" },
    });

    return tx.user.update({
      where: { id: req.userId },
      data: {
        xp: { increment: gainedXp },
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

  res.json({ ok: true, gainedXp, stat, user });
});


export default router;
