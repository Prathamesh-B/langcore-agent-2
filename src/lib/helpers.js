// src/lib/helpers.js
import { Buffer } from "buffer";
import * as cookie from "cookie";
import crypto from "crypto";

export function base64UrlEncode(str) {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function makeRawEmail({ to, subject, body, from }) {
  const mail = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=\"UTF-8\"",
    "",
    body || ""
  ].join("\r\n");
  return base64UrlEncode(mail);
}

// simple cookie helper - signs value with COOKIE_SECRET HMAC for tamper detection
export function signValue(secret, value) {
  const h = crypto.createHmac("sha256", secret).update(value).digest("hex");
  return `${value}--${h}`;
}

export function verifySignedValue(secret, signed) {
  if (!signed) return null;
  const idx = signed.lastIndexOf("--");
  if (idx === -1) return null;
  const value = signed.slice(0, idx);
  const mac = signed.slice(idx + 2);
  const expected = crypto.createHmac("sha256", secret).update(value).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return null;
  return value;
}

export function parseCookies(req) {
  return cookie.parse(req.headers.get("cookie") || "");
}
