import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Fail fast at module load time — app will not start without JWT_SECRET.
// This prevents silent token signing with "undefined" as the secret.
const secret = process.env.JWT_SECRET;
if (!secret) {
  throw new Error(
    "FATAL: JWT_SECRET environment variable is not set. " +
    "Add it to your .env file or Vercel Environment Variables."
  );
}

// Assign to a const typed as string after the guard above —
// no unsafe `as string` assertion needed.
const JWT_SECRET: string = secret;
const TOKEN_EXPIRY = "7d";

export type JwtPayload = {
  userId: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN";
};

// Type guard instead of unsafe cast on jwt.verify output
function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.userId === "string" &&
    typeof v.role === "string" &&
    ["OWNER", "MANAGER", "CASHIER", "KITCHEN"].includes(v.role)
  );
}

export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, 10);
}

export async function comparePassword(
  plainPassword: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plainPassword, hash);
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return isJwtPayload(decoded) ? decoded : null;
  } catch {
    return null;
  }
}
