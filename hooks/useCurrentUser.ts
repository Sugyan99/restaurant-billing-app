"use client";
import { useState, useEffect } from "react";

type User = { id: string; name: string; role: string };

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/auth/me").then(r => r.json()).then(d => setUser(d.user ?? null));
  }, []);
  return { user, isOwner: user?.role === "OWNER" };
}
