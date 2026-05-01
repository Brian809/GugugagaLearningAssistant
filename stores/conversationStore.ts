import { create } from "zustand";
import { Platform } from "react-native";
import { Conversation, NewConversation } from "../db/schema";

interface ConversationState {
  conversations: Conversation[];
  activeId: string | null;
  isLoading: boolean;
  error: string | null;

  loadConversations: (type: Conversation["type"]) => Promise<void>;
  createConversation: (type: Conversation["type"], title: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  setActiveConversation: (id: string | null) => void;
  appendMessages: (id: string, newMessages: any[]) => Promise<void>;
  replaceMessages: (id: string, messages: any[]) => Promise<void>;
  updateTitle: (id: string, title: string) => Promise<void>;
}

const isWeb = Platform.OS === "web";
const STORAGE_KEY = "gg_conversations";

// ==================== Web helpers ====================
const webLoadAll = (): Conversation[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const webSaveAll = (c: Conversation[]) =>
  localStorage.setItem(STORAGE_KEY, JSON.stringify(c));

// ==================== Store ====================
export const useConversationStore = create<ConversationState>((set, get) => ({
  conversations: [],
  activeId: null,
  isLoading: false,
  error: null,

  loadConversations: async (type) => {
    set({ isLoading: true, error: null });
    try {
      if (isWeb) {
        const convs = webLoadAll()
          .filter((c: Conversation) => c.type === type)
          .sort((a: any, b: any) => b.updatedAt - a.updatedAt);
        set({ conversations: convs });
      } else {
        const d = require("drizzle-orm");
        const { db } = require("../db");
        const { conversations: tbl } = require("../db/schema");
        const convs: Conversation[] = db
          .select()
          .from(tbl)
          .where(d.eq(tbl.type, type))
          .orderBy(d.desc(tbl.updatedAt))
          .all();
        set({ conversations: convs });
      }
    } catch (e: any) {
      set({ error: e.message || "加载对话失败" });
    } finally {
      set({ isLoading: false });
    }
  },

  createConversation: async (type, title) => {
    const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const now = Date.now();
    const conv: Conversation = {
      id,
      type,
      title: title.length > 50 ? title.substring(0, 47) + "..." : title,
      messages: "[]",
      createdAt: now,
      updatedAt: now,
    };

    if (isWeb) {
      const convs = webLoadAll();
      convs.unshift(conv);
      webSaveAll(convs);
      set(s => ({ conversations: [conv, ...s.conversations], activeId: id }));
      return id;
    }

    set({ isLoading: true, error: null });
    try {
      const { db } = require("../db");
      const { conversations: tbl } = require("../db/schema");
      db.insert(tbl).values(conv).run();
      set(s => ({ conversations: [conv, ...s.conversations], activeId: id }));
      return id;
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteConversation: async (id) => {
    if (isWeb) {
      webSaveAll(webLoadAll().filter((c: Conversation) => c.id !== id));
      set(s => ({
        conversations: s.conversations.filter(c => c.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
      }));
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const d = require("drizzle-orm");
      const { db } = require("../db");
      const { conversations: tbl } = require("../db/schema");
      db.delete(tbl).where(d.eq(tbl.id, id)).run();
      set(s => ({
        conversations: s.conversations.filter(c => c.id !== id),
        activeId: s.activeId === id ? null : s.activeId,
      }));
    } catch (e: any) {
      set({ error: e.message });
      throw e;
    } finally {
      set({ isLoading: false });
    }
  },

  setActiveConversation: (id) => set({ activeId: id }),

  appendMessages: async (id, newMessages) => {
    const existing = get().conversations.find(c => c.id === id);
    if (!existing) return;
    const parsed = JSON.parse(existing.messages);
    const updated = JSON.stringify([...parsed, ...newMessages]);
    const updatedAt = Date.now();

    if (isWeb) {
      const convs = webLoadAll();
      const idx = convs.findIndex((c: Conversation) => c.id === id);
      if (idx !== -1) {
        convs[idx] = { ...convs[idx], messages: updated, updatedAt };
        webSaveAll(convs);
      }
    } else {
      try {
        const d = require("drizzle-orm");
        const { db } = require("../db");
        const { conversations: tbl } = require("../db/schema");
        db.update(tbl)
          .set({ messages: updated, updatedAt })
          .where(d.eq(tbl.id, id))
          .run();
      } catch (e: any) {
        console.error("appendMessages:", e);
      }
    }

    set(s => ({
      conversations: s.conversations.map(c =>
        c.id === id ? { ...c, messages: updated, updatedAt } : c
      ),
    }));
  },

  replaceMessages: async (id, messages) => {
    const existing = get().conversations.find(c => c.id === id);
    if (!existing) return;
    const serialized = JSON.stringify(messages);
    const updatedAt = Date.now();

    if (isWeb) {
      const convs = webLoadAll();
      const idx = convs.findIndex((c: Conversation) => c.id === id);
      if (idx !== -1) {
        convs[idx] = { ...convs[idx], messages: serialized, updatedAt };
        webSaveAll(convs);
      }
    } else {
      try {
        const d = require("drizzle-orm");
        const { db } = require("../db");
        const { conversations: tbl } = require("../db/schema");
        db.update(tbl)
          .set({ messages: serialized, updatedAt })
          .where(d.eq(tbl.id, id))
          .run();
      } catch (e: any) {
        console.error("replaceMessages:", e);
      }
    }

    set(s => ({
      conversations: s.conversations.map(c =>
        c.id === id ? { ...c, messages: serialized, updatedAt } : c
      ),
    }));
  },

  updateTitle: async (id, title) => {
    if (isWeb) {
      const convs = webLoadAll();
      const idx = convs.findIndex((c: Conversation) => c.id === id);
      if (idx !== -1) {
        convs[idx] = { ...convs[idx], title, updatedAt: Date.now() };
        webSaveAll(convs);
      }
    } else {
      try {
        const d = require("drizzle-orm");
        const { db } = require("../db");
        const { conversations: tbl } = require("../db/schema");
        db.update(tbl)
          .set({ title, updatedAt: Date.now() })
          .where(d.eq(tbl.id, id))
          .run();
      } catch (e: any) {
        console.error("updateTitle:", e);
      }
    }

    set(s => ({
      conversations: s.conversations.map(c =>
        c.id === id ? { ...c, title } : c
      ),
    }));
  },
}));

export const useConversationList = () =>
  useConversationStore(s => s.conversations);
export const useActiveConversationId = () =>
  useConversationStore(s => s.activeId);
export const useConversationLoading = () =>
  useConversationStore(s => s.isLoading);
