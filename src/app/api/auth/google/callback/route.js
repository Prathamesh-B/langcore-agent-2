// src/app/api/auth/google/callback/route.js
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { signValue } from "../../../../../lib/helpers.js";

export async function GET(req) {
  // req.url contains query code
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  const oAuth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_OAUTH_REDIRECT
  );

  const { tokens } = await oAuth2Client.getToken(code);

  // tokens contain access_token, refresh_token (only first time), expiry_date etc
  // store them in a cookie (signed)
  const secret = process.env.COOKIE_SECRET || "dev-secret";
  const base = Buffer.from(JSON.stringify(tokens)).toString("base64");
  const signed = signValue(secret, base);

  const redirectUrl = new URL(process.env.NEXT_PUBLIC_BASE_URL || "/", req.url).toString();

  return new Response(null, {
    status: 302,
    headers: {
      'Location': redirectUrl,
      'Set-Cookie': `g_tokens=${signed}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`
    }
  });
}