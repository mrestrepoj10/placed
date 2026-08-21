"use server";

import { redirect } from "next/navigation";

import { disconnect } from "@/lib/auth/access-token";
import { getVisitorId } from "@/lib/auth/visitor";

export async function disconnectAction() {
  const visitorId = await getVisitorId();
  if (visitorId) {
    await disconnect(visitorId);
  }
  redirect("/");
}
