// src/app/api/gmail/search/route.js
import { NextResponse } from "next/server";
import { gmail_search } from "@/src/lib/gmail.js";

export async function POST(req) {
  const { query, maxResults } = await req.json().catch(() => ({}));
  try {
    const msgs = await gmail_search(req, query ?? "in:inbox", maxResults ?? 10);
    return NextResponse.json({ messages: msgs });
  } catch (err) {
    if (err.message === "AUTH_REQUIRED") {
      return NextResponse.json({ error: "AUTH_REQUIRED" }, { status: 401 });
    }
    return NextResponse.json({ error: String(err.message) }, { status: 500 });
  }
}
