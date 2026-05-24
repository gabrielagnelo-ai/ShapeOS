import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { signUpSchema } from "./validations";

export const sessionCookieName = "shapeos_session";
const sessionTtlDays = 30;

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

export async function createSessionRecord(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionTtlDays * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashSessionToken(token),
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function createSession(userId: string) {
  const { token, expiresAt } = await createSessionRecord(userId);
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
