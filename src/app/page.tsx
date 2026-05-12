'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Menu,
  Moon,
  Sun,
  Code2,
  Loader2,
  Trash2,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChatStore } from '@/lib/chat-store';
import { ChatMessage } from '@/components/chat/chat-message';
import { PromptSuggestions } from '@/components/chat/prompt-suggestions';
import { ChatSidebar } from '@/components/chat/sidebar';

export default function Home() {
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { theme, setTheme } = useTheme();
  const {
    chats,
    activeChatId,
    isStreaming,
    createChat,
    addMessage,
    updateLastAssistantMessage,
    setStreaming,
    getActiveChat,
    deleteChat,
  } = useChatStore();

  const activeChat = getActiveChat();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [activeChat?.messages, scrollToBottom]);

  const handleSend = useCallback(
    async (prompt?: string) => {
      const messageText = prompt || input.trim();
      if (!messageText || isStreaming) return;

      let chatId = activeChatId;
      if (!chatId) {
        chatId = createChat();
      }

      const userMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        role: 'user' as const,
        content: messageText,
        timestamp: Date.now(),
      };

      addMessage(chatId, userMessage);
      setInput('');

      // Add empty assistant message for streaming
      const assistantMessage = {
        id: Date.now().toString(36) + Math.random().toString(36).substring(2),
        role: 'assistant' as const,
        content: '',
        timestamp: Date.now(),
      };
      addMessage(chatId, assistantMessage);

      setStreaming(true);

      try {
        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        const chatMessages = useChatStore
          .getState()
          .chats.find((c) => c.id === chatId)
          ?.messages.filter((m) => m.id !== assistantMessage.id)
          .map((m) => ({ role: m.role, content: m.content })) || [];

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: chatMessages }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to get response');
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let accumulated = '';

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            accumulated += chunk;
            updateLastAssistantMessage(chatId, accumulated);
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          // User cancelled
        } else {
          updateLastAssistantMessage(
            chatId,
            'Sorry, I encountered an error. Please try again.'
          );
        }
      } finally {
        setStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [
      input,
      isStreaming,
      activeChatId,
      createChat,
      addMessage,
      updateLastAssistantMessage,
      setStreaming,
    ]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const handleNewChat = () => {
    createChat();
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <ChatSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50">
                <Code2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h1 className="font-bold text-sm leading-tight">FrontEnd AI</h1>
                <p className="text-[11px] text-muted-foreground leading-tight">
                  Your front-end dev assistant
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {activeChat && activeChat.messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={handleNewChat}
                title="New Chat"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            >
              <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            </Button>
          </div>
        </header>

        {/* Chat Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full px-4 py-8">
              <div className="max-w-2xl w-full">
                {/* Welcome */}
                <div className="text-center mb-8">
                  <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-emerald-100 dark:bg-emerald-900/50 mb-4">
                    <Code2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">
                    Welcome to FrontEnd AI
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-md mx-auto">
                    Your expert AI assistant for React, Next.js, TypeScript,
                    Tailwind CSS, and everything front-end. Ask me anything!
                  </p>
                </div>

                {/* Prompt Suggestions */}
                <PromptSuggestions onPromptClick={(prompt) => handleSend(prompt)} />
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto">
              {activeChat.messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  role={message.role}
                  content={message.content}
                  isStreaming={
                    isStreaming &&
                    message.role === 'assistant' &&
                    message.id ===
                      activeChat.messages[activeChat.messages.length - 1]?.id
                  }
                />
              ))}
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="border-t border-border bg-card/50 backdrop-blur-sm p-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-2 items-end">
              <div className="flex-1 relative">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything about front-end development..."
                  className="resize-none min-h-[44px] max-h-[200px] pr-4 py-3 text-sm rounded-xl border-border/50 focus-visible:ring-emerald-500/30"
                  rows={1}
                  disabled={isStreaming}
                />
              </div>
              {isStreaming ? (
                <Button
                  variant="destructive"
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0"
                  onClick={handleStopStreaming}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  className="h-11 w-11 rounded-xl shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => handleSend()}
                  disabled={!input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2 text-center">
              FrontEnd AI can make mistakes. Verify important code before using in production.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
