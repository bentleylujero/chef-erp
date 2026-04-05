import { NextRequest, NextResponse } from "next/server";
import { createUserWithAuth } from "@/lib/auth/user-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const result = await createUserWithAuth(body);

    if (!result.ok) {
      if (result.code === "validation") {
        return NextResponse.json(
          { error: "Invalid input", issues: result.issues },
          { status: 400 },
        );
      }
      if (result.code === "auth_exists") {
        return NextResponse.json({ error: result.message }, { status: 409 });
      }
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        userId: result.userId,
        email: result.email,
        name: result.name,
      },
      { status: 201 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sign up failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
