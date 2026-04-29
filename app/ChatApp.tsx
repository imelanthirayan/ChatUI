"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { APP_CONFIG } from "./chat.config";

// ---- Copy Button Component ----
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-gray-200"
      title="Copy to clipboard"
    >
      {copied ? (
        <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
        </svg>
      )}
    </button>
  );
}

// ---- Code Block with Copy Button ----
function CodeBlock({ children, className }: { children?: React.ReactNode; className?: string }) {
  const [copied, setCopied] = useState(false);
  const codeText = String(children).replace(/\n$/, "");
  const language = className?.replace(/^language-/, "") ?? "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(codeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group/code">
      <div className="flex items-center justify-between bg-[#1a1a2e] rounded-t-lg px-4 py-1.5 text-xs text-gray-400 border-b border-gray-700/50">
        <span>{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-gray-700/50 transition-colors text-gray-400 hover:text-gray-200"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3a2.25 2.25 0 00-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
              </svg>
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="!mt-0 !rounded-t-none">
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

// Custom ReactMarkdown components for code blocks
const markdownComponents = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  code({ className, children, ...props }: any) {
    const isBlock = className?.startsWith("language-");
    if (isBlock) {
      return <CodeBlock className={className}>{children}</CodeBlock>;
    }
    return <code className={className} {...props}>{children}</code>;
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pre({ children }: any) {
    // Let CodeBlock handle the <pre> wrapper
    return <>{children}</>;
  },
};

// ---- Types ----
interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface Chat {
  id: string;
  title: string;
  messages: Message[];
  chatOption: string;
  createdAt: number;
  updatedAt: number;
}

const SUGGESTIONS = APP_CONFIG.suggestions;
const CHAT_OPTIONS = APP_CONFIG.chatOptions;

// ---- Helpers ----
async function apiGetChats(userId: string): Promise<Chat[]> {
  const res = await fetch(`/api/chats?userId=${encodeURIComponent(userId)}`);
  const data = await res.json();
  // API returns metadata only (no messages), so default to empty array
  return data.map((c: Chat) => ({ ...c, messages: c.messages ?? [] }));
}

async function apiGetChat(userId: string, id: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}?userId=${encodeURIComponent(userId)}`);
  return res.json();
}

async function apiCreateChat(userId: string, chatOption: string): Promise<Chat> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title: "New Chat", chatOption }),
  });
  return res.json();
}

async function apiDeleteChat(userId: string, id: string): Promise<void> {
  await fetch(`/api/chats/${id}?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
}

async function apiRenameChat(userId: string, id: string, title: string): Promise<void> {
  await fetch(`/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, title }),
  });
}

async function apiAddMessage(userId: string, chatId: string, role: string, content: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${chatId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, role, content }),
  });
  return res.json();
}

// formatAssistantMessage removed — using ReactMarkdown instead

// ---- Icon Components ----
function SparkleIcon({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
      />
    </svg>
  );
}

function AssistantAvatar() {
  return (
    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full shrink-0 mt-0.5 overflow-hidden">
      <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} className="w-full h-full object-contain" />
    </div>
  );
}

// ---- Confirm Modal Component ----
function ConfirmModal({ title, message, confirmLabel, confirmColor, onConfirm, onCancel }: {
  title: string;
  message: string;
  confirmLabel?: string;
  confirmColor?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative bg-sidebar border border-gray-700 rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-400 mb-5">{message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-sm text-gray-300 hover:bg-hover transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${confirmColor ?? "bg-red-600 hover:bg-red-700"}`}
          >
            {confirmLabel ?? "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Main Component ----
interface ChatAppProps {
  userId: string;
  displayName: string;
  onLogout: () => void;
}


export default function ChatApp({ userId, displayName, onLogout }: ChatAppProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [selectedChatOption, setSelectedChatOption] = useState(APP_CONFIG.defaultChatOption);
  const [input, setInput] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filesPanelOpen, setFilesPanelOpen] = useState(false); // <-- right panel closed by default
  const [isStreaming, setIsStreaming] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmAction, setConfirmAction] = useState<{ type: "delete" | "logout"; chatId?: string } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // --- Right sidebar state ---
  const [fileList, setFileList] = useState<Array<{ name: string; type: string; path?: string; sessionId: string; sessionTitle: string; folder: string }>>([]); 
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const router = useRouter();

  // Fetch file metadata for the active chat session only
  useEffect(() => {
    async function fetchFiles() {
      if (!activeChatId) {
        setFileList([]);
        return;
      }
      const res = await fetch(`/api/files?sessionId=${encodeURIComponent(activeChatId)}`);
      if (!res.ok) return;
      const files = await res.json();
      setFileList(files);
    }
    fetchFiles();
  }, [activeChatId]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load from API on mount
  useEffect(() => {
    apiGetChats(userId).then((stored) => {
      setChats(stored);
      if (stored.length > 0) {
        setActiveChatId(stored[0].id);
        // Load messages for the most recent chat
        apiGetChat(userId, stored[0].id).then((full) => {
          setChats((prev) => prev.map((c) => (c.id === full.id ? full : c)));
        });
      }
    });
  }, [userId]);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;
  const isNewChat = !activeChat || (activeChat.messages ?? []).length === 0;
  const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages?.length, isStreaming, scrollToBottom]);

  // ---- Chat CRUD ----
  async function createNewChat() {
    const chat = await apiCreateChat(userId, selectedChatOption);
    setChats((prev) => [chat, ...prev]);
    setActiveChatId(chat.id);
    textareaRef.current?.focus();
  }

  async function loadChatById(id: string) {
    setActiveChatId(id);
    // Sync the dropdown to the loaded chat's option
    const existing = chats.find((c) => c.id === id);
    if (existing?.chatOption) {
      setSelectedChatOption(existing.chatOption);
    }
    // Fetch full messages if not already loaded
    if (!existing?.messages || existing.messages.length === 0) {
      const full = await apiGetChat(userId, id);
      setChats((prev) => prev.map((c) => (c.id === id ? full : c)));
      if (full.chatOption) {
        setSelectedChatOption(full.chatOption);
      }
    }
  }

  async function deleteChatById(id: string) {
    await apiDeleteChat(userId, id);
    const next = chats.filter((c) => c.id !== id);
    setChats(next);
    if (activeChatId === id) {
      setActiveChatId(next.length > 0 ? next[0].id : null);
    }
  }

  function startRename(id: string, currentTitle: string) {
    setRenamingId(id);
    setRenameValue(currentTitle);
  }

  async function commitRename() {
    if (!renamingId) return;
    const trimmed = renameValue.trim();
    if (trimmed) {
      await apiRenameChat(userId, renamingId, trimmed);
      setChats((prev) =>
        prev.map((c) => (c.id === renamingId ? { ...c, title: trimmed } : c))
      );
    }
    setRenamingId(null);
    setRenameValue("");
  }

  // ---- Send Message ----
  async function sendMessage(text?: string) {
    const content = (text ?? input).trim();
    if (!content) return;

    let chatId = activeChatId;

    // Auto-create chat if needed
    if (!chatId) {
      const newChat = await apiCreateChat(userId, selectedChatOption);
      setChats((prev) => [newChat, ...prev]);
      chatId = newChat.id;
      setActiveChatId(chatId);
    }

    // Optimistically add user message to UI
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c;
        const isFirst = (c.messages ?? []).length === 0;
        const title = isFirst
            ? content.length > 40
              ? content.substring(0, 40) + "..."
              : content
            : c.title;
        return {
          ...c,
          title,
          chatOption: isFirst ? selectedChatOption : c.chatOption,
          messages: [...(c.messages ?? []), { role: "user" as const, content, timestamp: Date.now() }],
          updatedAt: Date.now(),
        };
      })
    );
    setInput("");

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Update chatOption on server if user changed it before first message
    const existingChat = chats.find((c) => c.id === chatId);
    if (existingChat && (existingChat.messages ?? []).length === 0 && existingChat.chatOption !== selectedChatOption) {
      await fetch(`/api/chats/${chatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, chatOption: selectedChatOption }),
      });
    }

    // Persist user message to file
    const updatedChat = await apiAddMessage(userId, chatId, "user", content);
    setChats((prev) => prev.map((c) => {
      if (c.id !== chatId) return c;
      // Merge server data but preserve local timestamps
      const mergedMessages = (updatedChat.messages ?? []).map((msg: Message, idx: number) => ({
        ...msg,
        timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
      }));
      return { ...updatedChat, chatOption: selectedChatOption, messages: mergedMessages };
    }));

    // Call LLM backend via proxy route (streaming)
    try {
      // Add a placeholder assistant message for streaming
      setChats((prev) =>
        prev.map((c) => {
          if (c.id !== chatId) return c;
          return {
            ...c,
            messages: [...(c.messages ?? []), { role: "assistant" as const, content: "", timestamp: Date.now() }],
          };
        })
      );

      const abortController = new AbortController();
      abortControllerRef.current = abortController;
      setIsStreaming(true);

      const llmRes = await fetch(APP_CONFIG.llmEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          chatOption: selectedChatOption,
          history: activeChat?.messages ?? [],
        }),
        signal: abortControllerRef.current?.signal,
      });

      if (!llmRes.ok) {
        const errData = await llmRes.json().catch(() => null);
        const errMsg = errData?.response ?? `Backend error (${llmRes.status})`;
        // Replace placeholder with error
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = { role: "assistant", content: `⚠️ ${errMsg}` };
            return { ...c, messages: msgs };
          })
        );
        await apiAddMessage(userId, chatId!, "assistant", `⚠️ ${errMsg}`);
        return;
      }

      const reader = llmRes.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let fullReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;
          const data = trimmed.slice(6);
          if (data === "[DONE]") continue;
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              fullReply += `\n⚠️ ${parsed.error}`;
            } else if (parsed.content) {
              fullReply += parsed.content;
            }
          } catch {
            continue;
          }
        }

        // Update the assistant message in real-time
        const currentReply = fullReply;
        setChats((prev) =>
          prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = { role: "assistant", content: currentReply, timestamp: msgs[msgs.length - 1]?.timestamp };
            return { ...c, messages: msgs };
          })
        );
      }

      // Persist the complete reply
      setIsStreaming(false);
      abortControllerRef.current = null;
      const withReply = await apiAddMessage(userId, chatId!, "assistant", fullReply || "No response from backend.");
      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) return c;
        const mergedMessages = (withReply.messages ?? []).map((msg: Message, idx: number) => ({
          ...msg,
          timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
        }));
        return { ...withReply, chatOption: c.chatOption, messages: mergedMessages };
      }));
    } catch (err) {
      setIsStreaming(false);
      abortControllerRef.current = null;

      // If user aborted, persist what we have so far
      if (err instanceof DOMException && err.name === "AbortError") {
        const currentChats = chats;
        const currentChat = currentChats.find((c) => c.id === chatId);
        const lastMsg = currentChat?.messages?.[currentChat.messages.length - 1];
        const partialContent = lastMsg?.role === "assistant" ? lastMsg.content : "";
        if (partialContent) {
          const withPartial = await apiAddMessage(userId, chatId!, "assistant", partialContent + "\n\n*— Generation stopped*");
          setChats((prev) => prev.map((c) => {
            if (c.id !== chatId) return c;
            const msgs = [...(c.messages ?? [])];
            msgs[msgs.length - 1] = { role: "assistant", content: partialContent + "\n\n*— Generation stopped*", timestamp: msgs[msgs.length - 1]?.timestamp };
            return { ...c, messages: msgs };
          }));
        }
        return;
      }

      const errMsg = err instanceof Error ? err.message : "Unknown error";
      const withErr = await apiAddMessage(userId, chatId!, "assistant", `⚠️ Error: ${errMsg}`);
      setChats((prev) => prev.map((c) => {
        if (c.id !== chatId) return c;
        const mergedMessages = (withErr.messages ?? []).map((msg: Message, idx: number) => ({
          ...msg,
          timestamp: c.messages?.[idx]?.timestamp ?? msg.timestamp,
        }));
        return { ...withErr, chatOption: c.chatOption, messages: mergedMessages };
      }));
    }
  }

  // ---- Input Handling ----
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleInput(e: ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }


  return (
    <div className="flex h-screen bg-main text-white overflow-hidden">
      {/* Sidebar Backdrop (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar */}
      <aside
        className={`w-64 bg-sidebar flex flex-col h-full shrink-0 transition-transform duration-200 fixed md:relative z-30 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2.5">
          <img src={APP_CONFIG.logo} alt={APP_CONFIG.name} className="w-12 h-12 shrink-0" />
          <span className="text-lg font-semibold text-gray-200 truncate">{APP_CONFIG.name}</span>
        </div>

        {/* New Chat */}
        <div className="p-3 pt-1">
          <button
            onClick={createNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-hover text-sm text-gray-200 transition-colors border border-gray-700"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            New Chat
          </button>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto scrollbar-thin px-2 space-y-0.5">
          {sortedChats.map((chat) => (
            <button
              key={chat.id}
              onClick={() => loadChatById(chat.id)}
              onDoubleClick={(e) => {
                e.preventDefault();
                startRename(chat.id, chat.title);
              }}
              className={`w-full group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm truncate transition-colors ${
                chat.id === activeChatId
                  ? "bg-hover text-white"
                  : "text-gray-400 hover:bg-hover hover:text-gray-200"
              }`}
            >
              {renamingId === chat.id ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename();
                    if (e.key === "Escape") { setRenamingId(null); setRenameValue(""); }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 min-w-0 bg-transparent text-white text-sm outline-none border-b border-gray-500"
                />
              ) : (
                <span className="truncate">{chat.title}</span>
              )}
              {renamingId !== chat.id && (
                <div className="flex md:hidden md:group-hover:flex items-center gap-0.5 shrink-0">
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(chat.id, chat.title);
                    }}
                    className="p-1 rounded hover:bg-gray-600/30 text-gray-600 hover:text-gray-300 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125"
                      />
                    </svg>
                  </span>
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmAction({ type: "delete", chatId: chat.id });
                    }}
                    className="p-1 rounded hover:bg-red-500/20 hover:text-red-400 text-gray-600 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                      />
                    </svg>
                  </span>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-800">
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-shell-red/20 flex items-center justify-center text-shell-yellow text-xs font-bold uppercase shrink-0">
              {displayName.charAt(0)}
            </div>
            <span className="text-sm text-gray-300 truncate flex-1">{displayName}</span>
            <button
              onClick={() => setConfirmAction({ type: "logout" })}
              title="Logout"
              className="p-1.5 rounded-lg hover:bg-hover text-gray-500 hover:text-gray-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3-3h-9m9 0-3-3m3 3-3 3" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        {/* Top Bar */}
        <header className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/50">
          <button
            onClick={() => setSidebarOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-hover transition-colors text-gray-400"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <h1 className="text-sm font-medium text-gray-300 truncate">
            {activeChat?.title ?? "New Chat"}
          </h1>
          {(() => {
            const optionValue = isNewChat ? selectedChatOption : (activeChat?.chatOption || selectedChatOption);
            const optionLabel = CHAT_OPTIONS.find((o) => o.value === optionValue)?.label ?? optionValue;
            return optionValue ? (
              <span className="text-xs text-gray-500 bg-gray-800 rounded-md px-2 py-0.5 shrink-0">
                {optionLabel}
              </span>
            ) : null;
          })()}
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {isNewChat ? (
            /* Welcome Screen */
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="mb-6">
                <div className={`${APP_CONFIG.welcomeScreen?.heroImageSize ?? "w-25 h-25"} rounded-full flex items-center justify-center mx-auto mb-4`}>
                  <img
                    src={APP_CONFIG.welcomeScreen?.heroImage || APP_CONFIG.logo}
                    alt={APP_CONFIG.name}
                    className="w-full h-full object-contain"
                  />
                </div>
                <h2 className="text-2xl font-semibold text-gray-100 mb-2">{APP_CONFIG.welcomeHeading}</h2>
                <p className="text-gray-500 text-sm max-w-md">
                  {APP_CONFIG.welcomeSubtext}
                </p>
              </div>
              {(APP_CONFIG.welcomeScreen?.showSuggestions ?? true) && (
                <div className={`grid gap-2 max-w-lg w-full`} style={{ gridTemplateColumns: `repeat(${APP_CONFIG.welcomeScreen?.suggestionColumns ?? 2}, minmax(0, 1fr))` }}>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left p-3 rounded-xl border border-gray-700 hover:bg-hover text-sm text-gray-400 transition-colors"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Messages List */
            <div className="max-w-3xl mx-auto px-2 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
              {(activeChat?.messages ?? []).map((msg, i) =>
                msg.role === "user" ? (
                  <div key={`${activeChatId}-${i}`} className="flex justify-end group">
                    <div className="flex items-start gap-1">
                      {APP_CONFIG.showCopyButton && <CopyButton text={msg.content} />}
                      <div className="bg-input rounded-2xl px-3 sm:px-4 py-2 sm:py-2.5 max-w-[95%] sm:max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap">
                        {msg.content}
                        {APP_CONFIG.showTimestamps && msg.timestamp && (
                          <div className="text-[10px] text-gray-500 mt-1 text-right">
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div key={`${activeChatId}-${i}`} className="flex gap-2 sm:gap-3 group">
                    <AssistantAvatar />
                    <div className="message-content prose prose-invert prose-sm max-w-[95%] sm:max-w-[85%] text-gray-200">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{msg.content}</ReactMarkdown>
                      {APP_CONFIG.showTimestamps && msg.timestamp && (
                        <div className="text-[10px] text-gray-500 mt-1">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                    {APP_CONFIG.showCopyButton && <CopyButton text={msg.content} />}
                  </div>
                )
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="px-2 sm:px-4 pb-3 sm:pb-4 pt-2">
          <div className="max-w-3xl mx-auto">
            <div className="relative bg-input rounded-2xl border border-gray-700 focus-within:border-gray-500 transition-colors">
              {isNewChat && CHAT_OPTIONS.length > 1 && (
                <div className="flex items-center gap-2 px-3 pt-2.5 pb-0">
                  <select
                    value={selectedChatOption}
                    onChange={(e) => setSelectedChatOption(e.target.value)}
                    className="model-dropdown bg-input text-xs text-gray-300 border border-gray-700 rounded-lg px-2.5 py-1.5 outline-none cursor-pointer hover:border-gray-500 focus:border-shell-yellow transition-colors"
                  >
                    {CHAT_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                placeholder={APP_CONFIG.inputPlaceholder}
                className="w-full bg-transparent text-white placeholder-gray-500 text-sm px-4 py-3 pr-12 resize-none outline-none scrollbar-thin rounded-2xl"
                style={{ maxHeight: 200 }}
                onKeyDown={handleKeyDown}
                onChange={handleInput}
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim()}
                className={`absolute right-2 bottom-2 p-1.5 rounded-lg bg-white text-black hover:bg-gray-200 transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${isStreaming ? "hidden" : ""}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
                </svg>
              </button>
              {isStreaming && (
                <button
                  onClick={() => abortControllerRef.current?.abort()}
                  className="absolute right-2 bottom-2 p-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
                  title="Stop generating"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-600 text-center mt-2">
              {APP_CONFIG.footerDisclaimer}
            </p>
          </div>
        </div>
      </main>
      {/* Right Sidebar: File List (toggleable) */}
      {APP_CONFIG.showFilesPanel && filesPanelOpen && (
        <aside className="w-64 bg-sidebar flex flex-col h-full shrink-0 border-l border-gray-800/70">
          <div className="px-4 pt-4 pb-2 flex items-center gap-2.5 border-b border-gray-800/70">
            <span className="text-lg font-semibold text-gray-200 truncate">Files</span>
            <button
              className="ml-auto p-1.5 rounded-lg hover:bg-hover transition-colors text-gray-400"
              title="Close Files Panel"
              onClick={() => setFilesPanelOpen(false)}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin px-2 py-2 space-y-2">
            {fileList.map((file) => {
              const fileLabel = file.name.endsWith(`.${file.type}`) ? file.name : `${file.name}.${file.type}`;
              const menuKey = `${file.sessionId}-${file.name}`;  
              return (
                <div key={menuKey} className="relative group flex items-center justify-between px-2 py-1 rounded hover:bg-hover text-sm text-gray-300 border border-gray-700 mb-1">
                  <span className="truncate" style={{ wordBreak: 'break-all' }}>
                    {fileLabel}
                  </span>
                  <button
                    className="ml-2 p-1 rounded hover:bg-gray-700"
                    onClick={() => setMenuOpenId(menuOpenId === menuKey ? null : menuKey)}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <circle cx="12" cy="5" r="1.5" />
                      <circle cx="12" cy="12" r="1.5" />
                      <circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                  {menuOpenId === menuKey && (
                    <div className="absolute right-2 top-8 z-10 bg-main border border-gray-700 rounded shadow-lg min-w-[120px]">
                      <button
                        className="block w-full text-left px-4 py-2 text-sm hover:bg-hover text-gray-200"
                        onClick={() => {
                          setMenuOpenId(null);
                          // Use a hidden link to trigger download
                          const link = document.createElement('a');
                          link.href = file.path ?? '';
                          link.download = fileLabel;
                          document.body.appendChild(link);
                          link.click();
                          document.body.removeChild(link);
                        }}
                      >
                        Download
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </aside>
      )}
      {/* Show open button if panel is closed */}
      {APP_CONFIG.showFilesPanel && !filesPanelOpen && (
        <button
          className="fixed right-0 top-15 z-40 bg-sidebar border border-gray-800/70 rounded-l-lg px-3 py-2 text-gray-300 hover:bg-hover shadow-lg"
          title="Open Files Panel"
          onClick={() => setFilesPanelOpen(true)}
        >
          {/* Folder icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
        </button>
      )}

      {/* Confirmation Modal */}
      {confirmAction && confirmAction.type === "delete" && (
        <ConfirmModal
          title="Delete Chat"
          message="Are you sure you want to delete this chat? This action cannot be undone."
          confirmLabel="Delete"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={() => {
            if (confirmAction.chatId) deleteChatById(confirmAction.chatId);
            setConfirmAction(null);
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction && confirmAction.type === "logout" && (
        <ConfirmModal
          title="Log Out"
          message="Are you sure you want to log out?"
          confirmLabel="Log Out"
          confirmColor="bg-red-600 hover:bg-red-700"
          onConfirm={() => {
            setConfirmAction(null);
            onLogout();
          }}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}