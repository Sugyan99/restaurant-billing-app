"use client";
import { useState, useEffect } from "react";

type User = {
  id: string;
  name: string;
  role: string;
  kitchenStation?: string | null;
  tenantId?: string;
};

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => setUser(d.user ?? null));
  }, []);

  return {
    user,
    isOwner:   user?.role === "OWNER",
    isManager: user?.role === "OWNER" || user?.role === "MANAGER",
    isCashier: user?.role === "CASHIER",
    isKitchen: user?.role === "KITCHEN",
    kitchenStation: user?.kitchenStation ?? null,
    tenantId: user?.tenantId ?? null,
  };
}
