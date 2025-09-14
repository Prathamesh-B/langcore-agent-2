"use client";
import React, { useState, useRef, useEffect } from "react";

export default function Chat() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Hello 👋 — Ask me to search Gmail, draft or send emails. Example: 'Find emails from alice@example.com in last 7 days' or 'Draft an email to bob@example.com about meeting'.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDraftToConfirm, setPendingDraftToConfirm] = useState(null);

  const chatEndRef = useRef(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function sendMessage() {
    if (!input.trim()) return;
    const userMsg = { role: "user", content: input };
    const newMsgs = [...messages, userMsg];
    setMessages(newMsgs);
    setInput("");
    setLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMsgs }),
      });
      const data = await resp.json();

      if (resp.status === 401 && data.error === "AUTH_REQUIRED") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ AUTH_REQUIRED: Please sign in again at /api/auth/google/login",
          },
        ]);
        setLoading(false);
        return;
      }

      if (data.type === "final") {
        setMessages((prev) => [...prev, { role: "assistant", content: data.content }]);
      } else if (data.type === "confirm_send") {
        setPendingDraftToConfirm({ draftId: data.draftId, message: data.message });
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "✉️ I drafted a message. Confirm to send?" },
        ]);
      } else {
        setMessages((prev) => [...prev, { role: "assistant", content: JSON.stringify(data) }]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error: " + String(err) },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function confirmSend() {
    if (!pendingDraftToConfirm) return;
    setLoading(true);
    try {
      const res = await fetch("/api/gmail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: pendingDraftToConfirm.draftId }),
      });
      const data = await res.json();
      if (res.status === 401 && data.error === "AUTH_REQUIRED") {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "⚠️ AUTH_REQUIRED: Please sign in again at /api/auth/google/login",
          },
        ]);
      } else if (data.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: "✅ Message sent successfully!\n\n" + JSON.stringify(data.result, null, 2),
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "❌ Send failed: " + JSON.stringify(data) },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "❌ Error: " + String(err) },
      ]);
    } finally {
      setPendingDraftToConfirm(null);
      setLoading(false);
    }
  }

  function renderMessage(m, i) {
    const isUser = m.role === "user";
    return (
      <div key={i} className={`flex ${isUser ? "justify-end" : "justify-start"} my-2`}>
        <div
          className={`max-w-[75%] px-4 py-2 rounded-2xl shadow ${
            isUser
              ? "bg-blue-600 text-white rounded-br-none"
              : "bg-gray-100 text-gray-900 rounded-bl-none"
          }`}
        >
          <pre className="whitespace-pre-wrap text-sm">{m.content}</pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
        {messages.map(renderMessage)}
        <div ref={chatEndRef} />
      </div>

      {/* Pending Draft */}
      {pendingDraftToConfirm && (
        <div className="px-4 py-3 bg-yellow-50 border-t text-sm">
          <p className="mb-2">{pendingDraftToConfirm.message}</p>
          <div className="flex gap-2">
            <button
              onClick={confirmSend}
              className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded"
            >
              Confirm Send
            </button>
            <button
              onClick={() => setPendingDraftToConfirm(null)}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 border-t bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring focus:ring-indigo-300 text-sm"
          placeholder="Type a request for the agent..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition"
        >
          {loading ? "Thinking..." : "Send"}
        </button>
      </div>
    </div>
  );
}
