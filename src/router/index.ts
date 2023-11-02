import { Router } from "express";
import { db } from "../../drizzle/index.js";
import { customer, loan } from "../../drizzle/schema.js";

const router = Router();

router.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

router.get("/customer", async (req, res) => {
  const data = await db.select().from(customer).execute();
  res.json(data);
});

router.get("/loan", async (req, res) => {
  const data = await db.select().from(loan).execute();
  res.json(data);
});

export default router;
