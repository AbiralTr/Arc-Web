import express from "express";
import { engine } from "express-handlebars";
import path from "path";

const app = express();
const PORT = 3000;

app.engine("hbs", engine({ extname: ".hbs" }));
app.set("view engine", "hbs");
app.set("views", path.join(process.cwd(), "views"));

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.render("home");
});

app.listen(PORT, () => console.log("Arc listening on", PORT));