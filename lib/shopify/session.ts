import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { config } from "@/lib/config";

export type SessionPayload = {
  shop: string;
  storeId: string;
};

const COOKIE_NAME = "rp_session";

export function signSession(payload: SessionPayload) {
  return jwt.sign(payload, config.sessionJwtSecret, { expiresIn: "7d" });
}

export function verifySession(token: string): SessionPayload | null {
  try {
    const decoded = jwt.verify(token, config.sessionJwtSecret);
    if (!decoded || typeof decoded !== "object") return null;

    const shop = "shop" in decoded ? decoded.shop : null;
    const storeId = "storeId" in decoded ? decoded.storeId : null;

    if (typeof shop !== "string" || typeof storeId !== "string" || !shop || !storeId) {
      return null;
    }

    return { shop, storeId };
  } catch {
    return null;
  }
}

export async function getSessionFromCookies(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/"
  });
}
