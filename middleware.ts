// This file MUST be named `middleware.ts` at the project root for Next.js to load it.
// The actual logic lives in proxy.ts to keep it testable in isolation.
import { NextRequest } from "next/server";
import { proxy, config } from "./proxy";

export { config };

export default function middleware(req: NextRequest) {
  return proxy(req);
}
