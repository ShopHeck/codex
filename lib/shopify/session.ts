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
    return jwt.verify(token, config.sessionJwtSecret) as SessionPayload;
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
  cookieStore.set(COOKIE_NAME, token, { httpOnly: true, sameSite: "lax", secure: true, path: "/" });
}
