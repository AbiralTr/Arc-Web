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
    
    const friendships = await prisma.friendship.findMany({
        where:{
            status: "ACCEPTED",
            OR: [{requesterId: meId}, {addresseeId: meId}],
        },
        include: {
            requester: { select: { id: true, username: true, level: true } },
            addressee: { select: { id: true, username: true, level: true } },
        },
        orderBy: { updatedAt: "desc" },
    });

    const friendsList = friendships.map((f) => {
        const other = f.requesterId === meId ? f.addressee : f.requester;
        return { friendshipId: f.id, user: other };
    });

    const me = await prisma.user.findUnique({
        where: {id: meId},
        select: {id: true, username: true, level: true},
    });

    const friends = [
        {friendshipId: "me", user: me}, // me 
        ...friendsList, // list
    ].sort((a, b) => 
        (b.user.level) - (a.user.level)
    );

    res.render("leaderboard", {title: "Users", users, friends, me});
});

export default router;