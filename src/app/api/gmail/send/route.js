// src/app/api/gmail/send/route.js
import { NextResponse } from "next/server";
import { gmail_send } from "../../../../lib/gmail.js";

export async function POST(req) {
  const { draftId } = await req.json().catch(() => ({}));
  if (!draftId) return NextResponse.json({ error: "Missing draftId" }, { status: 400 });
  try {
    const res = await gmail_send(req, draftId, { confirmed: true });
    return NextResponse.json({ ok: true, result: res });
  } catch (err) {
    if (err.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    return NextResponse.json({ error: String(err.message) }, { status: 500 });
  }
}
