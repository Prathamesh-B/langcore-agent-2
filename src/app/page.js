// src/app/page.jsx
import Chat from "../components/Chat";
// import { Mail } from "lucide-react";

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="w-full max-w-3xl flex flex-col bg-white rounded-2xl shadow-lg overflow-hidden">
        {/* Header */}
        <header className="flex items-center gap-2 px-6 py-4 border-b bg-gradient-to-r from-blue-600 to-indigo-600 text-white">
          {/* <Mail className="w-6 h-6" /> */}
          <h1 className="text-lg font-semibold">Gmail ReAct Agent</h1>
        </header>

        {/* Info */}
        <div className="px-6 py-3 text-sm text-gray-600 bg-gray-50 border-b">
          Sign in with Google to allow the agent to search, draft, and send
          emails. Sending requires your confirmation.
        </div>

        {/* Sign-in */}
        <div className="px-6 py-3 border-b">
          <a
            href="/api/auth/google/login"
            className="inline-block px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition"
          >
            Sign in with Google
          </a>
        </div>

        {/* Chat */}
        <div className="flex-1 flex flex-col">
          <Chat />
        </div>
      </div>
    </main>
  );
}
