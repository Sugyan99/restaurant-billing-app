"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function FloorRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard/tables"); }, [router]);
  return null;
}
