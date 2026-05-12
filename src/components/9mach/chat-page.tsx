'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface Workspace {
  id: string;
  name: string;
  createdAt: string;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  createdAt: string;
}

interface ChatPageProps {
  user: { id: string; email: string; fullName: string | null; isApproved: boolean };
  onLogout: () => void;
}

// Parse ANSI-like terminal color codes for rendering
function TerminalText({ content }: { content: string }) {
  // Pre-process: convert ANSI sequences into tagged segments
  const segments: Array<{ text: string; color: string }> = [];
  let currentColor = '';
  const parts = content.split(/(\x1b\[\d+m)/);

  for (const part of parts) {
    if (part === '\x1b[32m') { currentColor = 'text-green-400'; continue; }
    if (part === '\x1b[33m') { currentColor = 'text-yellow-400'; continue; }
    if (part === '\x1b[31m') { currentColor = 'text-red-400'; continue; }
    if (part === '\x1b[0m') { currentColor = ''; continue; }
    if (!part) continue;
    segments.push({ text: part, color: currentColor });
  }

  return (
    <>
      {segments.map((seg, i) => (
        <span key={i} className={seg.color || 'text-gray-300'}>
          {seg.text}
        </span>
      ))}
    </>
  );
}

export function ChatPage({ user, onLogout }: ChatPageProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(true);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const scrollToBottom = useCallback(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  // Fetch workspaces
  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = await res.json();
      if (data.workspaces) {
        setWorkspaces(data.workspaces);
        if (data.workspaces.length > 0 && !activeWorkspaceId) {
          setActiveWorkspaceId(data.workspaces[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
    }
  }, [activeWorkspaceId]);

  // Fetch messages for active workspace
  const fetchMessages = useCallback(async () => {
    if (!activeWorkspaceId) {
      setMessages([]);
      return;
    }
    try {
      const res = await fetch(`/api/messages?workspace_id=${activeWorkspaceId}`);
      const data = await res.json();
      if (data.messages) {
        setMessages(data.messages);
      }
    } catch (err) {
      console.error('Failed to fetch messages:', err);
    }
  }, [activeWorkspaceId]);

  // Update preview URL when workspace changes
  useEffect(() => {
    if (activeWorkspaceId && previewOpen) {
      setPreviewUrl(`/api/preview/${activeWorkspaceId}/`);
    } else {
      setPreviewUrl('');
    }
  }, [activeWorkspaceId, previewOpen]);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const createWorkspace = async () => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Workspace' }),
      });
      const data = await res.json();
      if (data.workspace) {
        setWorkspaces((prev) => [data.workspace, ...prev]);
        setActiveWorkspaceId(data.workspace.id);
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    }
  };

  const refreshPreview = useCallback(() => {
    if (activeWorkspaceId && previewOpen) {
      // Force iframe refresh by adding timestamp
      setPreviewUrl(`/api/preview/${activeWorkspaceId}/?_t=${Date.now()}`);
    }
  }, [activeWorkspaceId, previewOpen]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isStreaming || !activeWorkspaceId) return;

    setInput('');
    setIsStreaming(true);

    // Add user message optimistically
    const userMsg: Message = {
      id: 'temp-' + Date.now(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    // Add empty AI message for streaming
    const aiMsg: Message = {
      id: 'temp-ai-' + Date.now(),
      role: 'ai',
      content: '',
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, aiMsg]);

    try {
      const abortController = new AbortController();
      abortRef.current = abortController;

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: activeWorkspaceId, content: text }),
        signal: abortController.signal,
      });

      if (!response.ok) throw new Error('Failed to get response');

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          accumulated += chunk;

          // Update the AI message in real-time
          setMessages((prev) => {
            const updated = [...prev];
            const lastMsg = updated[updated.length - 1];
            if (lastMsg && lastMsg.role === 'ai') {
              updated[updated.length - 1] = { ...lastMsg, content: accumulated };
            }
            return updated;
          });
        }
      }

      // Refresh preview after AI completes
      setTimeout(() => {
        refreshPreview();
      }, 1000);

      // Refresh messages from DB to get processed output
      fetchMessages();
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg && lastMsg.role === 'ai' && !lastMsg.content) {
            updated[updated.length - 1] = {
              ...lastMsg,
              content: 'Sorry, I encountered an error. Please try again.',
            };
          }
          return updated;
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-4 py-3 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-black flex items-center justify-center">
              <span className="text-white font-bold text-sm">9</span>
            </div>
            <span className="font-bold text-lg">9mach AI</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setPreviewOpen(!previewOpen)}
            className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            {previewOpen ? 'Hide Preview' : 'Show Preview'}
          </button>
          {previewOpen && (
            <button
              onClick={refreshPreview}
              className="text-xs font-medium text-gray-500 hover:text-gray-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
              title="Refresh Preview"
            >
              ↻ Refresh
            </button>
          )}
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-gray-200 flex items-center justify-center">
              <span className="text-xs font-semibold text-gray-600">
                {user.fullName?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
              </span>
            </div>
            <button onClick={onLogout} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Workspaces */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 bg-black/30 z-30 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <aside className="fixed lg:relative z-40 h-[calc(100vh-57px)] w-64 bg-gray-50 border-r border-gray-100 flex flex-col shrink-0">
              <div className="p-3">
                <button
                  onClick={createWorkspace}
                  className="w-full flex items-center justify-center gap-2 bg-black text-white text-sm font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                  New Workspace
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                {workspaces.map((ws) => (
                  <button
                    key={ws.id}
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                      ws.id === activeWorkspaceId
                        ? 'bg-black text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <span className="truncate block">{ws.name}</span>
                  </button>
                ))}
                {workspaces.length === 0 && (
                  <p className="text-xs text-gray-400 text-center py-6">No workspaces yet</p>
                )}
              </div>
            </aside>
          </>
        )}

        {/* Main Split View */}
        <div className="flex-1 flex min-w-0">
          {/* Chat Panel - Terminal */}
          <div className={`flex flex-col ${previewOpen ? 'w-1/2' : 'w-full'} border-r border-gray-100`}>
            {/* Chat Header */}
            <div className="px-4 py-2.5 border-b border-gray-100 shrink-0 flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900 truncate">
                {activeWorkspace?.name || 'Select a workspace'}
              </p>
              {activeWorkspaceId && (
                <span className="text-xs text-gray-400 font-mono">
                  ~/project
                </span>
              )}
            </div>

            {/* Messages - Terminal Style */}
            <div className="flex-1 overflow-y-auto bg-gray-950 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-emerald-400 font-mono text-sm mb-1">user@nimarc:~$</p>
                    <p className="text-gray-500 font-mono text-xs">Describe what you want to build...</p>
                    <div className="mt-6 text-left max-w-xs mx-auto">
                      <p className="text-gray-600 font-mono text-xs mb-2">Try:</p>
                      <p className="text-gray-400 font-mono text-xs hover:text-white cursor-pointer" onClick={() => setInput('Build me a modern login page')}>→ Build me a modern login page</p>
                      <p className="text-gray-400 font-mono text-xs hover:text-white cursor-pointer mt-1" onClick={() => setInput('Create a dashboard with charts and stats')}>→ Create a dashboard with charts</p>
                      <p className="text-gray-400 font-mono text-xs hover:text-white cursor-pointer mt-1" onClick={() => setInput('Make a portfolio website with animations')}>→ Make a portfolio website</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="font-mono text-sm space-y-4">
                  {messages.map((msg) => (
                    <div key={msg.id}>
                      {msg.role === 'user' ? (
                        <div>
                          <span className="text-emerald-400">user@nimarc:~$</span>
                          <span className="text-white ml-2 whitespace-pre-wrap">{msg.content}</span>
                        </div>
                      ) : (
                        <div className="pl-0">
                          <span className="text-cyan-400 font-bold">AI:</span>
                          <div className="mt-1 whitespace-pre-wrap text-xs leading-relaxed">
                            <TerminalText content={msg.content || ''} />
                            {!msg.content && isStreaming && (
                              <span className="inline-flex gap-1">
                                <span className="animate-pulse text-emerald-400">●</span>
                                <span className="animate-pulse text-emerald-400 [animation-delay:0.2s]">●</span>
                                <span className="animate-pulse text-emerald-400 [animation-delay:0.4s]">●</span>
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>

            {/* Chat Input - Terminal Style */}
            <div className="shrink-0 bg-black p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 flex items-end bg-gray-900 rounded-lg border border-gray-800">
                  <span className="text-emerald-400 font-mono text-xs px-3 py-3 shrink-0">user@nimarc:~$</span>
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Describe what you want to build..."
                    disabled={isStreaming}
                    rows={1}
                    className="flex-1 bg-transparent text-white text-sm font-mono py-3 pr-3 resize-none outline-none placeholder:text-gray-600 min-h-[40px] max-h-[120px]"
                  />
                </div>
                <button
                  onClick={isStreaming ? () => abortRef.current?.abort() : handleSend}
                  disabled={!isStreaming && !input.trim()}
                  className={`shrink-0 h-10 w-10 rounded-lg flex items-center justify-center transition-colors ${
                    isStreaming
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-30'
                  }`}
                >
                  {isStreaming ? (
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="1" />
                    </svg>
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Preview Panel */}
          {previewOpen && (
            <div className="w-1/2 flex flex-col bg-white">
              <div className="px-4 py-2.5 border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500" />
                  <p className="text-sm font-medium text-gray-900">Live Preview</p>
                </div>
                <button
                  onClick={refreshPreview}
                  className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1"
                >
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                  Refresh
                </button>
              </div>
              <div className="flex-1 bg-white">
                {previewUrl ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-full border-0"
                    title="Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center text-gray-300">
                    <div className="text-center">
                      <svg className="h-12 w-12 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                      </svg>
                      <p className="text-sm">Ask AI to build something</p>
                      <p className="text-xs mt-1">Preview will appear here</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
