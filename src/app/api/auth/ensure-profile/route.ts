import { NextResponse } from "next/server";
import {
  ensureAppUser,
  getSessionAuthUser,
} from "@/lib/auth/user-service";

export async function POST() {
  const authUser = await getSessionAuthUser();
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await ensureAppUser(authUser);
  return NextResponse.json({
    userId: user.id,
    email: user.email,
    name: user.name,
  });
}
