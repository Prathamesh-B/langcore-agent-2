"use client";
import React, { useState, useRef, useEffect } from "react";
import { Send, Mail, User, Bot, CheckCircle, XCircle } from "lucide-react";

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
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);

  const chatEndRef = useRef(null);
  
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Fetch user info on component mount
    fetchUserInfo();
  }, []);

  async function fetchUserInfo() {
    try {
      const response = await fetch('/api/auth/user');
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    } finally {
      setUserLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      setUser(null);
      // Optionally redirect to login page
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

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
        { role: "assistant", content: "⚠ Error: " + String(err) },
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
          { role: "assistant", content: "⚠ Send failed: " + JSON.stringify(data) },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠ Error: " + String(err) },
      ]);
    } finally {
      setPendingDraftToConfirm(null);
      setLoading(false);
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  function renderMessage(m, i) {
    const isUser = m.role === "user";
    const isError = m.content.includes("Error:") || m.content.includes("AUTH_REQUIRED");
    const isSuccess = m.content.includes("✅");
    
    return (
      <div key={i} className="flex items-start gap-3 py-4 group hover:bg-slate-800/30 px-4 transition-colors">
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser 
            ? "bg-blue-600" 
            : "bg-slate-700"
        }`}>
          {isUser ? (
            <User className="w-4 h-4 text-white" />
          ) : (
            <Bot className="w-4 h-4 text-slate-300" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-sm font-medium ${
              isUser ? "text-blue-400" : "text-slate-300"
            }`}>
              {isUser ? "You" : "Gmail Agent"}
            </span>
          </div>
          <div className={`prose prose-sm max-w-none ${
            isError 
              ? "text-red-400" 
              : isSuccess 
                ? "text-green-400" 
                : "text-slate-200"
          }`}>
            <pre className="whitespace-pre-wrap text-sm font-sans bg-transparent p-0 m-0 border-0">
              {m.content}
            </pre>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
            <Mail className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg font-semibold text-white">Gmail ReAct Agent</h1>
        </div>
        <div className="flex items-center gap-4">
          {userLoading ? (
            <div className="text-sm text-slate-400">Loading...</div>
          ) : user ? (
            <>
              <div className="text-sm text-slate-400">Welcome, {user.name || user.email}</div>
              <button 
                onClick={handleLogout}
                className="text-sm text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Log Out
              </button>
            </>
          ) : (
            <div className="text-sm text-slate-400">Not signed in</div>
          )}
        </div>
      </header>

      {/* Auth Status */}
      <div className="px-6 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-300">
            {user ? 
              "Connected to Gmail. You can now search, draft, and send emails. Sending requires your confirmation." :
              "Sign in with Google to allow the agent to search, draft, and send emails. Sending requires your confirmation."
            }
          </div>
          {!user && (
            <a
              href="/api/auth/google/login"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
            >
              <CheckCircle className="w-4 h-4" />
              Sign in with Google
            </a>
          )}
          {user && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium">
              <CheckCircle className="w-4 h-4" />
              Connected as {user.email}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-900">
        <div className="max-w-4xl mx-auto">
          {messages.map(renderMessage)}
          {loading && (
            <div className="flex items-start gap-3 py-4 px-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-slate-300" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-slate-300">Gmail Agent</span>
                </div>
                <div className="flex items-center gap-2 text-slate-400">
                  <div className="flex gap-1">
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                    <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                  </div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={chatEndRef} />
      </div>

      {/* Pending Draft Confirmation */}
      {pendingDraftToConfirm && (
        <div className="px-6 py-4 bg-amber-900/20 border-t border-amber-800">
          <div className="max-w-4xl mx-auto">
            <p className="text-amber-200 mb-3">{pendingDraftToConfirm.message}</p>
            <div className="flex gap-3">
              <button
                onClick={confirmSend}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <CheckCircle className="w-4 h-4" />
                Confirm Send
              </button>
              <button
                onClick={() => setPendingDraftToConfirm(null)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-6 py-4 border-t border-slate-800 bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={handleKeyPress}
                className="w-full p-4 pr-12 bg-slate-800 border border-slate-700 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-slate-400 resize-none min-h-[56px] max-h-32"
                placeholder="I'm your personal assistant. How can I help you today?"
                rows="1"
                style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#475569 transparent'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="absolute right-3 bottom-3 p-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}