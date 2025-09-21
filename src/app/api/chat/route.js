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

  // Improved system prompt with clearer instructions
  const system = `
You are a Gmail assistant that uses tools to help users. Follow these rules EXACTLY:

1. When you need to use a tool, respond with ONLY this JSON (no extra text):
{"type":"action","action":"<tool_name>","args":{...}}

2. After getting tool results, you MUST respond with:
{"type":"final","content":"Your helpful response to the user based on the results"}

Available tools:
- gmail_search: Search emails (args: { "query": string, "maxResults": number })
- gmail_get_message: Get email details (args: { "messageId": string, "format": "full"|"metadata" })
- gmail_create_draft: Create draft email (args: { "to": string, "subject": string, "body": string })
- gmail_send: Send draft (args: { "draftId": string, "confirmed": boolean })

Examples:
User: "Show me my latest emails"
Assistant: {"type":"action","action":"gmail_search","args":{"query":"in:inbox","maxResults":5}}

After tool result:
Assistant: {"type":"final","content":"Here are your latest 5 emails: [summarize results]"}

CRITICAL: Always end with type:"final" after tool execution. Never create multiple drafts or repeat actions.
`;

  const conv = [
    { role: "system", content: system },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ];

  for (let step = 0; step < 8; step++) { // Increased to 8 steps
    const llmRespText = await callOpenRouter(conv);

    let actionObj = null;
    try {
      // Better JSON extraction
      let jsonText = llmRespText.trim();
      const jsonStart = jsonText.indexOf("{");
      const jsonEnd = jsonText.lastIndexOf("}");
      
      if (jsonStart >= 0 && jsonEnd > jsonStart) {
        jsonText = jsonText.slice(jsonStart, jsonEnd + 1);
      }
      
      actionObj = JSON.parse(jsonText);
    } catch (parseError) {
      // If JSON parsing fails, try to create a final response
      console.log("JSON parse error:", parseError, "Raw response:", llmRespText);
      
      // If it looks like a regular text response, wrap it as final
      if (!llmRespText.includes("{") && !llmRespText.includes("}")) {
        return jsonResponse({ 
          type: "final", 
          content: llmRespText.trim() 
        });
      }
      
      // Otherwise return the parsing error
      return jsonResponse({
        error: "Model did not return valid JSON",
        raw: llmRespText,
        step: step + 1
      }, 500);
    }

    // Handle final response
    if (actionObj.type === "final") {
      return jsonResponse({ type: "final", content: actionObj.content });
    }

    // Handle tool actions
    if (actionObj.type === "action") {
      const { action, args } = actionObj;
      
      // Add the action to conversation history
      conv.push({ 
        role: "assistant", 
        content: JSON.stringify(actionObj) 
      });
      
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
            toolResult = { error: "UNKNOWN_TOOL: " + action };
        }

        // Handle authentication required
        if (
          toolResult === "AUTH_REQUIRED" ||
          (toolResult && toolResult.error === "AUTH_REQUIRED")
        ) {
          return jsonResponse({ error: "AUTH_REQUIRED" }, 401);
        }

        // Handle confirmation needed for email sending
        if (toolResult && toolResult.need_confirmation) {
          return jsonResponse({
            type: "confirm_send",
            draftId: toolResult.draftId,
            message: "I've prepared your email draft. Click Confirm to send it.",
          });
        }

        // Add tool result to conversation with clear instruction to respond
        const toolObservation = JSON.stringify(toolResult, null, 2);
        conv.push({
          role: "user",
          content: `Tool result: ${toolObservation}\n\nNow respond to the user with {"type":"final","content":"your response"} based on this result.`
        });

      } catch (err) {
        if (err?.message?.includes("AUTH_REQUIRED")) {
          return jsonResponse({ error: "AUTH_REQUIRED" }, 401);
        }
        
        // Add error to conversation and let the model handle it
        const errorMsg = String(err?.message ?? err);
        conv.push({
          role: "user",
          content: `Tool error: ${errorMsg}\n\nRespond to the user with {"type":"final","content":"explanation of the error"}`
        });
      }
    } else {
      return jsonResponse({
        error: "Unknown action type from model",
        actionObj,
        step: step + 1
      }, 500);
    }
  }

  // If we hit max steps, return a helpful message instead of an error
  return jsonResponse({ 
    type: "final", 
    content: "I apologize, but I'm having trouble completing that request. Please try rephrasing your question or break it into smaller parts."
  });
}