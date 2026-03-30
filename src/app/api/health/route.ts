import { NextResponse } from "next/server";

/** No DB — use to verify the dev server is reachable. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "chef-erp",
    time: new Date().toISOString(),
  });
}
