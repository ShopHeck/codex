import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.shopifyStore.update({ where: { id: session.storeId }, data: { onboardingCompleted: true } });
  return NextResponse.json({ ok: true });
}
