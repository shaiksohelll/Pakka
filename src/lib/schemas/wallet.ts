import { z } from "zod";

export const topupWalletSchema = z.object({
  amount: z
    .number({ invalid_type_error: "Amount must be a number." })
    .min(100, "Minimum top-up is ₹100.")
    .max(100000, "Maximum top-up is ₹1,00,000."),
  idempotency_key: z.string().uuid(),
});

export type TopupWalletInput = z.infer<typeof topupWalletSchema>;
