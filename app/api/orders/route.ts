import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.order.findMany({
    where: { storeId: session.storeId },
    orderBy: { orderDate: "desc" },
    take: 100
  });

  return NextResponse.json({ orders });
}
