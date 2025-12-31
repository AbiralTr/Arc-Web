import express from "express";
import { engine } from "express-handlebars";
import path from "path";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { prisma } from "./db.js";
import authRouter from "./routes/auth.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static("public"));
app.use(express.json()); 
app.use(cookieParser()); 

// Routes
app.use("/api/auth", authRouter);

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/db-test", async (req, res) => {
  const userCount = await prisma.user.count();
  res.json({ ok: true, userCount });
});

app.get("/register", (req, res) => res.render("register"));

app.get("/login", (req, res) => res.render("login"));


app.listen(PORT, () => console.log("Arc listening on", PORT));
