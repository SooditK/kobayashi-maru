import { sql } from "drizzle-orm";
import {
  text,
  blob,
  integer,
  sqliteTable,
  real,
} from "drizzle-orm/sqlite-core";

export const customer = sqliteTable("customer", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  first_name: text("first_name"),
  last_name: text("last_name"),
  age: integer("age", { mode: "number" }),
  phone_number: integer("phone_number", { mode: "number" }),
  monthly_salary: integer("monthly_salary", { mode: "number" }),
  approved_limit: integer("approved_limit", { mode: "number" }),
});

export const loan = sqliteTable("loan", {
  id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  customer_id: integer("customer_id", { mode: "number" }).references(
    () => customer.id
  ),
  loan_amount: integer("loan_amount", { mode: "number" }),
  interest_rate: real("interest_rate"),
  tenure: integer("tenure", { mode: "number" }),
  monthly_payment: integer("monthly_payment", { mode: "number" }),
  emi_paid_on_time: integer("emi_paid_on_time", { mode: "number" }),
  start_date: integer("start_date", { mode: "timestamp_ms" }),
  end_date: integer("end_date", { mode: "timestamp_ms" }),
});
