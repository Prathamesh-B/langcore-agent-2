// src/app/api/chat/route.js
import { callOpenRouter } from "../../../lib/openrouter.js";
import * as gmailTools from "../../../lib/gmail.js";

// Small helper to return JSON responses with correct headers
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req) {
  const body = await req.json().catch(() => null);
  if (!body?.messages) {
    return jsonResponse({ error: "Invalid request, pass messages" }, 400);
  }

  // System prompt
  const system = `
You are a ReAct-style assistant. When you want to use a tool, respond with EXACTLY this JSON structure (no extra text):

{"type":"action","action":"<tool_name>","args":{...}}

For example, to create a draft:
{"type":"action","action":"gmail_create_draft","args":{"to":"user@example.com","subject":"Meeting","body":"Email content"}}

Supported tools:
- gmail_search (args: { "query":string, "maxResults":int })
- gmail_get_message (args: { "messageId":string, "format": "full"|"raw"|"metadata" })
- gmail_create_draft (args: { "to":string, "subject":string, "body":string })
- gmail_send (args: { "draftId":string, "confirmed":boolean })

When you are done, respond with:
{"type":"final","content":"Your final message to the user"}

IMPORTANT: Always use "type":"action" for tool calls, never use the tool name as the type.
`;

  const conv = [
    { role: "system", content: system },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let step = 0; step < 6; step++) {
    const llmRespText = await callOpenRouter(conv);

    let actionObj = null;
    try {
      const jsonStart = llmRespText.indexOf("{");
      const json = jsonStart >= 0 ? llmRespText.slice(jsonStart) : llmRespText;
      actionObj = JSON.parse(json);
    } catch {
      conv.push({ role: "assistant", content: llmRespText });
      return jsonResponse(
        { error: "Model did not return valid action JSON", raw: llmRespText },
        500
      );
    }

    if (actionObj.type === "final") {
      return jsonResponse({ type: "final", content: actionObj.content });
    }

    if (actionObj.type === "action") {
      const { action, args } = actionObj;
      try {
        let toolResult;
        switch (action) {
          case "gmail_search":
            toolResult = await gmailTools.gmail_search(
              req,
              args?.query ?? "in:inbox",
              args?.maxResults ?? 10
            );
            break;
          case "gmail_get_message":
            toolResult = await gmailTools.gmail_get_message(
              req,
              args?.messageId,
              args?.format ?? "full"
            );
            break;
          case "gmail_create_draft":
            toolResult = await gmailTools.gmail_create_draft(
              req,
              args?.to,
              args?.subject,
              args?.body
            );
            break;
          case "gmail_send":
            toolResult = await gmailTools.gmail_send(req, args?.draftId, {
              confirmed: !!args?.confirmed,
            });
            break;
          default:
            toolResult = { error: "UNKNOWN_TOOL" };
        }

        if (
          toolResult === "AUTH_REQUIRED" ||
          (toolResult && toolResult.error === "AUTH_REQUIRED")
        ) {
          conv.push({
            role: "assistant",
            content: `{"observation":"AUTH_REQUIRED"}`,
          });
          return jsonResponse({ error: "AUTH_REQUIRED" }, 401);
        }

        if (toolResult && toolResult.need_confirmation) {
          return jsonResponse({
            type: "confirm_send",
            draftId: toolResult.draftId,
            message:
              "Agent requests confirmation to send draft. Click Confirm to send.",
          });
        }

        const obsString = JSON.stringify(toolResult, null, 2);
        conv.push({
          role: "assistant",
          content: `{"observation": ${JSON.stringify(obsString)} }`,
        });
      } catch (err) {
        if (err?.message?.includes("AUTH_REQUIRED")) {
          return jsonResponse({ error: "AUTH_REQUIRED" }, 401);
        }
        const errObs = { error: String(err?.message ?? err) };
        conv.push({
          role: "assistant",
          content: `{"observation": ${JSON.stringify(JSON.stringify(errObs))}}`,
        });
      }
    } else {
      return jsonResponse(
        { error: "Unknown action type from model", actionObj },
        500
      );
    }
  }

  return jsonResponse({ error: "Max steps reached" }, 500);
}
