import { eq } from "drizzle-orm";
import { Router } from "express";
import * as z from "zod";
import { db } from "../../drizzle/index.js";
import {
  customer,
  customerInsertSchema,
  loan,
  loanSelectSchema,
} from "../../drizzle/schema.js";

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

router.post("/register", async (req, res) => {
  const data = await customerInsertSchema
    .omit({ id: true, approved_limit: true })
    .safeParseAsync(req.body);
  if (!data.success) {
    res.status(400).json(data.error);
  } else {
    // approved limit is 36 * monthly_salary (rounded to nearest lakh)
    if (data.data.monthly_salary) {
      const approved_limit =
        Math.round(data.data.monthly_salary / 100000) * 100000 * 36;
      const [inserted_customer] = await db
        .insert(customer)
        .values({
          ...data.data,
          approved_limit,
        })
        .returning()
        .execute();
      if (inserted_customer) {
        res.json(inserted_customer);
      } else {
        res.status(400).json({ message: "Error inserting customer" });
      }
    } else {
      res.status(400).json({ message: "monthly_salary is required" });
    }
  }
});

const loanSchema = z.object({
  customer_id: z.number(),
  loan_amount: z.number(),
  interest_rate: z.number(),
  tenure: z.number(),
});

function calculateMonthlyInstallment(
  total_amount: number,
  interest_rate: number,
  tenure: number
) {
  const monthly_interest_rate = interest_rate / 1200;
  const monthly_installment =
    (total_amount * monthly_interest_rate) /
    (1 - Math.pow(1 + monthly_interest_rate, -tenure));
  return monthly_installment;
}

function checkLoanApproval(
  customer_id: number,
  creditScore: number,
  interest_rate: number,
  tenure: number,
  total_amount: number
) {
  if (creditScore > 50) {
    return {
      customer_id,
      approval: true,
      interest_rate,
      corrected_interest_rate: interest_rate,
      tenure,
      monthly_installment: calculateMonthlyInstallment(
        total_amount,
        interest_rate,
        tenure
      ),
    };
  } else if (creditScore > 30 && creditScore <= 50) {
    const corrected_interest_rate = interest_rate > 12 ? interest_rate : 12;
    return {
      customer_id,
      approval: true,
      interest_rate,
      corrected_interest_rate,
      tenure,
      monthly_installment: calculateMonthlyInstallment(
        total_amount,
        corrected_interest_rate,
        tenure
      ),
    };
  } else if (creditScore > 10 && creditScore <= 30) {
    const corrected_interest_rate = interest_rate > 16 ? interest_rate : 16;
    return {
      customer_id,
      approval: true,
      interest_rate,
      corrected_interest_rate,
      tenure,
      monthly_installment: calculateMonthlyInstallment(
        total_amount,
        corrected_interest_rate,
        tenure
      ),
    };
  } else {
    // do not approve any loans
    return {
      customer_id,
      approval: false,
      interest_rate,
      corrected_interest_rate: 0,
      tenure,
      monthly_installment: 0,
    };
  }
}

async function calculateCreditScore(
  loans: Array<z.infer<typeof loanSelectSchema>>,
  customer_id: number
) {
  const [monthly_salary] = await db
    .select({ monthly_salary: customer.monthly_salary })
    .from(customer)
    .where(eq(customer.id, customer_id))
    .execute();
  const numberOfLoansPaidOnTime = loans.filter(
    (loan) => loan.end_date !== null && loan.end_date < new Date()
  ).length;
  const numberOfLoansTaken = loans.length;
  const loanApprovedVolume = loans
    .map((loan) => loan.loan_amount)
    .reduce((partial_sum, a) => partial_sum! + a!, 0);
  const sumOfCurrentLoans = loans
    .filter((loan) => loan.end_date === null || loan.end_date > new Date())
    .map((loan) => loan.loan_amount)
    .reduce((partial_sum, a) => partial_sum! + a!, 0);

  let creditScore = 0;
  if (numberOfLoansPaidOnTime > 0) {
    creditScore += numberOfLoansPaidOnTime * 5;
  }
  if (numberOfLoansTaken > 0) {
    creditScore += numberOfLoansTaken * 10;
  }
  if (loanApprovedVolume && loanApprovedVolume > 0) {
    creditScore += loanApprovedVolume / 1000;
  }
  if (
    sumOfCurrentLoans &&
    sumOfCurrentLoans > 0 &&
    sumOfCurrentLoans > monthly_salary.monthly_salary! * 0.5
  ) {
    creditScore = 0;
  }

  // Ensure the credit score is between 0 and 100
  creditScore = Math.max(0, Math.min(creditScore, 100));

  return Math.round(creditScore);
}

router.post("/check-eligibility", async (req, res) => {
  const data = await loanSchema.safeParseAsync(req.body);
  if (!data.success) {
    res.status(400).json(data.error);
  } else {
    const { customer_id, loan_amount, interest_rate, tenure } = data.data;
    const loans = await db
      .select()
      .from(loan)
      .where(eq(loan.customer_id, customer_id))
      .execute();
    const creditScore = await calculateCreditScore(loans, customer_id);
    if (creditScore === 0) {
      return {
        customer_id: customer_id,
        approval: false,
        interest_rate: 0,
        corrected_interest_rate: 0,
        tenure: 0,
        monthly_installment: 0,
      };
    } else {
      const loanApproval = checkLoanApproval(
        customer_id,
        creditScore,
        interest_rate,
        tenure,
        loan_amount
      );
      res.json(loanApproval);
    }
  }
});

router.post("/create-loan", async (req, res) => {
  const data = await loanSchema.safeParseAsync(req.body);
  if (!data.success) {
    res.status(400).json(data.error);
  } else {
    const { customer_id, loan_amount, interest_rate, tenure } = data.data;
    const loans = await db
      .select()
      .from(loan)
      .where(eq(loan.customer_id, customer_id))
      .execute();
    const creditScore = await calculateCreditScore(loans, customer_id);
    if (creditScore === 0) {
      return {
        customer_id: customer_id,
        approval: false,
        interest_rate: 0,
        corrected_interest_rate: 0,
        tenure: 0,
        monthly_installment: 0,
      };
    } else {
      const loanApproval = checkLoanApproval(
        customer_id,
        creditScore,
        interest_rate,
        tenure,
        loan_amount
      );
      if (loanApproval.approval) {
        let end_date = new Date();
        end_date.setMonth(end_date.getMonth() + tenure);
        const [inserted_loan] = await db
          .insert(loan)
          .values({
            customer_id,
            loan_amount,
            interest_rate: loanApproval.corrected_interest_rate,
            tenure,
            start_date: new Date(),
            emi_paid_on_time: 0,
            monthly_payment: loanApproval.monthly_installment,
            end_date,
          })
          .returning()
          .execute();
        if (inserted_loan) {
          res.json(inserted_loan);
        } else {
          res.status(400).json({ message: "Error inserting loan" });
        }
      } else {
        res.status(400).json({ message: "Loan not approved" });
      }
    }
  }
});

router.get("/view-loan/:loan_id", async (req, res) => {
  const loan_id = parseInt(req.params.loan_id);
  if (!loan_id) {
    res.status(400).json({ message: "loan_id is required" });
  } else {
    const [l] = await db
      .select()
      .from(loan)
      .where(eq(loan.id, loan_id))
      .execute();
    if (l) {
      res.json(l);
    } else {
      res.status(400).json({ message: "Loan not found" });
    }
  }
});

router.post("/make-payment/:customer_id/:loan_id", async (req, res) => {
  const customer_id = parseInt(req.params.customer_id);
  const loan_id = parseInt(req.params.loan_id);
  if (!loan_id || !customer_id) {
    res.status(400).json({ message: "loan_id and customer_id are required" });
  } else {
    const [l] = await db
      .select()
      .from(loan)
      .where(eq(loan.id, loan_id))
      .execute();
    if (l) {
      const [c] = await db
        .select()
        .from(customer)
        .where(eq(customer.id, customer_id))
        .execute();
      if (c && l.emi_paid_on_time) {
        const [updated_loan] = await db
          .update(loan)
          .set({
            emi_paid_on_time: l.emi_paid_on_time + 1,
          })
          .where(eq(loan.id, loan_id))
          .returning()
          .execute();
        if (updated_loan) {
          res.json(updated_loan);
        } else {
          res.status(400).json({ message: "Error updating loan" });
        }
      } else {
        res.status(400).json({ message: "Customer not found" });
      }
    } else {
      res.status(400).json({ message: "Loan not found" });
    }
  }
});

router.get("/view-statement/:customer_id/:loan_id", async (req, res) => {
  const customer_id = parseInt(req.params.customer_id);
  const loan_id = parseInt(req.params.loan_id);
  if (!loan_id || !customer_id) {
    res.status(400).json({ message: "loan_id and customer_id are required" });
  } else {
    const [l] = await db
      .select()
      .from(loan)
      .where(eq(loan.id, loan_id))
      .execute();
    if (l) {
      const [c] = await db
        .select()
        .from(customer)
        .where(eq(customer.id, customer_id))
        .execute();
      if (c) {
        res.json(l);
      } else {
        res.status(400).json({ message: "Customer not found" });
      }
    } else {
      res.status(400).json({ message: "Loan not found" });
    }
  }
});

export default router;
