// src/lib/gmail.js
import { google } from "googleapis";
import { parseCookies, verifySignedValue } from "./helpers.js";

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify"
];

function getOAuth2Client() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("Google OAuth2 client id/secret missing in env");
  }
  const o = new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET);
  return o;
}

// read tokens from cookie value (signed)
export function getTokensFromRequest(req) {
  // req is a Next Request in app router (web fetch Request). read cookie header
  const rawCookies = req.headers.get("cookie") || "";
  // simple parse
  const cookies = Object.fromEntries(rawCookies.split(";").map(s => {
    const [k, ...rest] = s.trim().split("=");
    if (!k) return [];
    return [k, rest.join("=")];
  }).filter(Boolean));
  const signed = cookies["g_tokens"];
  if (!signed) return null;
  const secret = process.env.COOKIE_SECRET || "dev-secret";
  const verified = verifySignedValue(secret, signed);
  if (!verified) return null;
  try {
    const tokens = JSON.parse(Buffer.from(verified, "base64").toString("utf8"));
    return tokens;
  } catch (err) {
    return null;
  }
}

function getGmailClientFromTokens(tokens) {
  if (!tokens) throw new Error("AUTH_REQUIRED");
  const oAuth2Client = getOAuth2Client();
  oAuth2Client.setCredentials(tokens);
  const gmail = google.gmail({ version: "v1", auth: oAuth2Client });
  return { gmail, oAuth2Client };
}

export async function gmail_search(req, query = "in:inbox", maxResults = 10) {
  const tokens = getTokensFromRequest(req);
  if (!tokens) throw new Error("AUTH_REQUIRED");
  const { gmail } = getGmailClientFromTokens(tokens);

  const res = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults
  });

  return res.data.messages || [];
}

export async function gmail_get_message(req, messageId, format = "full") {
  const tokens = getTokensFromRequest(req);
  if (!tokens) throw new Error("AUTH_REQUIRED");
  const { gmail } = getGmailClientFromTokens(tokens);

  const res = await gmail.users.messages.get({
    userId: "me",
    id: messageId,
    format
  });

  return res.data;
}

export async function gmail_create_draft(req, to, subject, body) {
  const tokens = getTokensFromRequest(req);
  if (!tokens) throw new Error("AUTH_REQUIRED");
  const { gmail } = getGmailClientFromTokens(tokens);

  // get profile to find 'from'
  const profile = await gmail.users.getProfile({ userId: "me" });
  const from = profile.data.emailAddress;

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body
  ].join("\r\n");

  const encoded = Buffer.from(raw).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const res = await gmail.users.drafts.create({
    userId: "me",
    requestBody: {
      message: {
        raw: encoded
      }
    }
  });

  return res.data; // contains id and message.id
}

// IMPORTANT: By default do NOT send. Caller must explicitly pass { confirmed: true } to actually send.
export async function gmail_send(req, draftId, opts = { confirmed: false }) {
  const tokens = getTokensFromRequest(req);
  if (!tokens) throw new Error("AUTH_REQUIRED");
  const { gmail } = getGmailClientFromTokens(tokens);

  if (!opts.confirmed) {
    // return object instructing frontend to ask user confirmation
    return { need_confirmation: true, draftId };
  }

  // Fetch draft to get raw
  const draft = await gmail.users.drafts.get({
    userId: "me",
    id: draftId
  });

  const raw = draft.data?.message?.raw;
  if (!raw) throw new Error("NO_RAW_MESSAGE_IN_DRAFT");

  // Send using drafts.send
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: {
      id: draftId
    }
  });

  return res.data; // message metadata
}
