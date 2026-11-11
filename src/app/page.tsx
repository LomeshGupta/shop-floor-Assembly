import { redirect } from "next/navigation";
import { getOperatorSession } from "@/lib/session/session";

export default async function RootPage() {
  const operator = await getOperatorSession();
  redirect(operator ? "/home" : "/login");
}
