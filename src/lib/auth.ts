import bcrypt from "bcryptjs";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signUpSchema } from "./validations";

export const sessionCookieName = "shapeos_session";
const sessionTtlDays = 30;
const sessionVersion = "v1";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function validateCredentials(input: unknown) {
  return signUpSchema.parse(input);
}

export function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET ?? process.env.DATABASE_URL ?? process.env.DIRECT_URL;

  if (!secret) {
    throw new Error("AUTH_SECRET, DATABASE_URL or DIRECT_URL is required for auth cookies.");
  }

  return secret;
}

function signSessionPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function safeCompare(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionCookieValue(userId: string, expiresAt: Date) {
  const payload = `${sessionVersion}.${userId}.${expiresAt.getTime()}`;
  return `${payload}.${signSessionPayload(payload)}`;
}

function parseSessionCookieValue(value: string) {
  const [version, userId, expiresAtMs, signature] = value.split(".");

  if (version !== sessionVersion || !userId || !expiresAtMs || !signature) {
    return null;
  }

  const payload = `${version}.${userId}.${expiresAtMs}`;
  const expectedSignature = signSessionPayload(payload);

  if (!safeCompare(signature, expectedSignature)) {
    return null;
  }

  const expiresAt = new Date(Number(expiresAtMs));
  if (Number.isNaN(expiresAt.getTime())) {
    return null;
  }

  return { userId, expiresAt };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  };
}

export async function createSession(userId: string) {
  const expiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);
  const token = createSessionCookieValue(userId, expiresAt);
  const cookieStore = await cookies();
  cookieStore.set(sessionCookieName, token, sessionCookieOptions(expiresAt));
}

export async function getCurrentUser() {
  const status = await getSessionStatus();
  return status.user;
}

export async function getSessionStatus() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;
  if (!token) {
    return { reason: "missing_cookie" as const, user: null, hasCookie: false, hasSession: false };
  }

  const signedSession = parseSessionCookieValue(token);

  if (signedSession) {
    if (signedSession.expiresAt < new Date()) {
      return { reason: "expired_session" as const, user: null, hasCookie: true, hasSession: true };
    }

    const user = await prisma.user.findUnique({ where: { id: signedSession.userId } });

    if (!user) {
      return { reason: "missing_user" as const, user: null, hasCookie: true, hasSession: false };
    }

    return { reason: "authenticated" as const, user, hasCookie: true, hasSession: true };
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
    include: { user: true },
  });

  if (!session) {
    return { reason: "missing_session" as const, user: null, hasCookie: true, hasSession: false };
  }

  if (session.expiresAt < new Date()) {
    return { reason: "expired_session" as const, user: null, hasCookie: true, hasSession: true };
  }

  return { reason: "authenticated" as const, user: session.user, hasCookie: true, hasSession: true };
}

export async function clearSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(sessionCookieName)?.value;

  if (token) {
    await prisma.session.deleteMany({
      where: { tokenHash: hashSessionToken(token) },
    });
  }

  cookieStore.delete(sessionCookieName);
}
