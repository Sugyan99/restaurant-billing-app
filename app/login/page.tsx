import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { verifyToken } from "@/lib/auth";
import LoginForm from "./LoginForm";

export default async function LoginPage() {
  const token = (await cookies()).get("token")?.value;
  if (token && verifyToken(token)) redirect("/dashboard/home");
  return <LoginForm />;
}
