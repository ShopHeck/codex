import { z } from "zod";

export const settingsSchema = z.object({
  paymentFeePercent: z.coerce.number().min(0).max(20),
  shopifyFeePercent: z.coerce.number().min(0).max(20),
  defaultShippingCost: z.coerce.number().min(0).max(500)
});
