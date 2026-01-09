import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import authRouter from "./routes/auth.js";
import questsRouter from "./routes/quests.js";
import userRouter from "./routes/user.js";
import {requirePageUser} from "./middleware/requirePageUser.js";
import friendsRouter from "./routes/friends.js";
import leaderboardRouter from "./routes/leaderboard.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static("public"));
app.use(express.json()); 
app.use(cookieParser()); 

app.use("/api/auth", authRouter);
app.use("/api/quests", questsRouter);
app.use("/api/user", userRouter);
app.use(leaderboardRouter);
app.use(friendsRouter);
app.use((req, res, next) => {
  res.locals.isAuthPage =
    req.path === "/login" || req.path === "/register";
  next();
});


// Routes
app.get("/", (req, res) => {
  res.send("Welcome to Arc API, please use the /home endpoint to access the web app.");
});


app.get("/home", requirePageUser, (req, res) => res.render("home"));

app.get("/register", (req, res) => res.render("register"));

app.get("/login", (req, res) => res.render("login"));

app.listen(PORT, () => console.log("Arc listening on", PORT));
