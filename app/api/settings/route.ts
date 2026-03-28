import { NextRequest, NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";
import { settingsSchema } from "@/lib/validation/settings";

export async function POST(req: NextRequest) {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const parsed = settingsSchema.safeParse({
    paymentFeePercent: formData.get("paymentFeePercent"),
    shopifyFeePercent: formData.get("shopifyFeePercent"),
    defaultShippingCost: formData.get("defaultShippingCost")
  });

  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await prisma.shopifyStore.update({ where: { id: session.storeId }, data: parsed.data });
  return NextResponse.redirect(new URL("/settings", req.url));
}
