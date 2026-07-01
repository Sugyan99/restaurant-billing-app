import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET as string;
const TOKEN_EXPIRY = "7d";

if (!JWT_SECRET) {
  // Fails loudly at startup instead of silently signing tokens with "undefined"
  console.warn(
    "WARNING: JWT_SECRET is not set in .env — set it before going to production."
  );
}

export type JwtPayload = {
  userId: string;
  role: "OWNER" | "MANAGER" | "CASHIER" | "KITCHEN";
};

export async function hashPassword(plainPassword: string): Promise<string> {
  const SALT_ROUNDS = 10;
  return bcrypt.hash(plainPassword, SALT_ROUNDS);
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
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    // Token expired or tampered with
    return null;
  }
}
