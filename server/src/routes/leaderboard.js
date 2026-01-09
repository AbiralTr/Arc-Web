import express from "express";
import { prisma } from "../db.js";
import { requireUser } from "../middleware/requireUser.js";

const router = express.Router();

router.get("/leaderboard", requireUser, async (req, res) => {
    const meId = req.userId;
    const users = await prisma.user.findMany({
        select: {id: true, username: true, level: true},
        take: 20,
        orderBy: {level: "desc"},
    });

    const friends = await prisma.user.findMany({
        where: {id: { not: meId } },
        select: {id: true, username: true, level: true},
        take: 20,
        orderBy: {level: "desc"},
    })
    res.render("leaderboard", {title: "Users", users, friends});
});

export default router;