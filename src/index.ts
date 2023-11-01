import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

const app = express();

app.use(express.json());
app.use(morgan("dev"));
app.disable("x-powered-by");
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    credentials: true,
    origin: process.env["FRONTEND_ORIGIN_URL"] ?? "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"],
  })
);
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.listen(parseInt(process.env["PORT"] ?? "8080"), () => {
  console.log(`Server listening on port ${process.env["PORT"] ?? "8080"}`);
});
