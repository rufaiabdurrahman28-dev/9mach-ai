import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface ChatState {
  chats: Chat[];
  activeChatId: string | null;
  isStreaming: boolean;

  // Actions
  createChat: () => string;
  deleteChat: (id: string) => void;
  setActiveChat: (id: string) => void;
  addMessage: (chatId: string, message: Message) => void;
  updateLastAssistantMessage: (chatId: string, content: string) => void;
  setStreaming: (streaming: boolean) => void;
  getActiveChat: () => Chat | undefined;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

function generateTitle(content: string): string {
  const trimmed = content.trim();
  if (trimmed.length <= 40) return trimmed;
  return trimmed.substring(0, 40) + '...';
}

export const useChatStore = create<ChatState>((set, get) => ({
  chats: [],
  activeChatId: null,
  isStreaming: false,

  createChat: () => {
    const id = generateId();
    const chat: Chat = {
      id,
      title: 'New Chat',
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    set((state) => ({
      chats: [chat, ...state.chats],
      activeChatId: id,
    }));
    return id;
  },

  deleteChat: (id) => {
    set((state) => {
      const filtered = state.chats.filter((c) => c.id !== id);
      return {
        chats: filtered,
        activeChatId:
          state.activeChatId === id
            ? filtered[0]?.id || null
            : state.activeChatId,
      };
    });
  },

  setActiveChat: (id) => {
    set({ activeChatId: id });
  },

  addMessage: (chatId, message) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        const updatedMessages = [...chat.messages, message];
        const title =
          chat.messages.length === 0 && message.role === 'user'
            ? generateTitle(message.content)
            : chat.title;
        return {
          ...chat,
          messages: updatedMessages,
          title,
          updatedAt: Date.now(),
        };
      }),
    }));
  },

  updateLastAssistantMessage: (chatId, content) => {
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        const messages = [...chat.messages];
        const lastMsg = messages[messages.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
          messages[messages.length - 1] = { ...lastMsg, content };
        }
        return { ...chat, messages, updatedAt: Date.now() };
      }),
    }));
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming });
  },

  getActiveChat: () => {
    const state = get();
    return state.chats.find((c) => c.id === state.activeChatId);
  },
}));
