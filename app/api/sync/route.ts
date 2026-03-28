import { NextResponse } from "next/server";
import { getSessionFromCookies } from "@/lib/shopify/session";
import { rebuildSnapshots } from "@/lib/services/profit";

export async function POST() {
  const session = await getSessionFromCookies();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await rebuildSnapshots(session.storeId);
  return NextResponse.json({ ok: true });
}
