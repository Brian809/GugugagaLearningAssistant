import { create } from "zustand";
import { Platform } from "react-native";
import { MistakeRecord, NewMistakeRecord } from "../db/schema";

interface NotebookFilter {
  subject?: string;
  isReviewed?: boolean;
  tag?: string;
}

interface NotebookState {
  records: MistakeRecord[];
  isLoading: boolean;
  error: string | null;
  filter: NotebookFilter;

  loadRecords: () => Promise<void>;
  addRecord: (record: NewMistakeRecord) => Promise<string>;
  updateRecord: (id: string, updates: Partial<MistakeRecord>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  toggleReviewed: (id: string) => Promise<void>;
  setFilter: (filter: Partial<NotebookFilter>) => void;
  searchRecords: (query: string) => Promise<MistakeRecord[]>;
}

// ==================== Web DB helpers (localStorage) ====================
const isWeb = Platform.OS === "web";
const STORAGE_KEY = "learning_notebook";

const webLoadAll = (): MistakeRecord[] => {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); }
  catch { return []; }
};
const webSaveAll = (r: MistakeRecord[]) => localStorage.setItem(STORAGE_KEY, JSON.stringify(r));

// ==================== Unified Store ====================
export const useNotebookStore = create<NotebookState>((set, get) => ({
  records: [],
  isLoading: false,
  error: null,
  filter: {},

  loadRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filter } = get();
      if (isWeb) {
        let recs = webLoadAll().sort((a: any, b: any) => b.createdAt - a.createdAt);
        if (filter.subject) recs = recs.filter(r => r.subject === filter.subject);
        if (filter.isReviewed !== undefined) recs = recs.filter(r => r.isReviewed === filter.isReviewed);
        if (filter.tag) recs = recs.filter(r => r.tags?.includes(filter.tag!));
        set({ records: recs });
      } else {
        // Native: use Drizzle ORM
        const d = require("drizzle-orm");
        const { eq, like, and, desc } = d;
        const { db } = require("../db");
        const { mistakeRecords } = require("../db/schema");
        const conds: any[] = [];
        if (filter.subject) conds.push(eq(mistakeRecords.subject, filter.subject));
        if (filter.isReviewed !== undefined) conds.push(eq(mistakeRecords.isReviewed, filter.isReviewed));
        if (filter.tag) conds.push(like(mistakeRecords.tags, `%${filter.tag}%`));
        const recs: MistakeRecord[] = conds.length > 0
          ? db.select().from(mistakeRecords).where(and(...conds)).orderBy(desc(mistakeRecords.createdAt)).all()
          : db.select().from(mistakeRecords).orderBy(desc(mistakeRecords.createdAt)).all();
        set({ records: recs });
      }
    } catch (e: any) { set({ error: e.message || "加载失败" }); }
    finally { set({ isLoading: false }); }
  },

  addRecord: async (record) => {
    if (isWeb) {
      const recs = webLoadAll();
      const n: MistakeRecord = {
        id: Math.random().toString(36).slice(2) + Date.now().toString(36),
        problemText: record.problemText,
        problemImage: record.problemImage ?? null,
        userAnswer: record.userAnswer,
        correctAnswer: record.correctAnswer,
        analysis: record.analysis ?? null,
        tags: record.tags ?? null,
        subject: record.subject ?? null,
        isReviewed: record.isReviewed ?? false,
        reviewCount: record.reviewCount ?? 0,
        lastReviewedAt: record.lastReviewedAt ?? null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      recs.unshift(n); webSaveAll(recs);
      set(s => ({ records: [n, ...s.records] }));
      return n.id;
    }
    set({ isLoading: true, error: null });
    try {
      const { db } = require("../db");
      const { mistakeRecords } = require("../db/schema");
      const inserted = db.insert(mistakeRecords).values(record).returning().get();
      set(s => ({ records: [inserted, ...s.records] }));
      return inserted.id;
    } catch (e: any) { set({ error: e.message }); throw e; }
    finally { set({ isLoading: false }); }
  },

  updateRecord: async (id, updates) => {
    if (isWeb) {
      const now = Date.now();
      const recs = webLoadAll();
      const idx = recs.findIndex(r => r.id === id);
      if (idx !== -1) { recs[idx] = { ...recs[idx], ...updates, updatedAt: now }; webSaveAll(recs); }
      set(s => ({ records: s.records.map(r => r.id === id ? { ...r, ...updates, updatedAt: now } : r) }));
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const now = Date.now();
      const d = require("drizzle-orm");
      const { db } = require("../db");
      const { mistakeRecords } = require("../db/schema");
      db.update(mistakeRecords).set({ ...updates, updatedAt: now }).where(d.eq(mistakeRecords.id, id)).run();
      set(s => ({ records: s.records.map(r => r.id === id ? { ...r, ...updates, updatedAt: now } : r) }));
    } catch (e: any) { set({ error: e.message }); throw e; }
    finally { set({ isLoading: false }); }
  },

  deleteRecord: async (id) => {
    if (isWeb) {
      webSaveAll(webLoadAll().filter(r => r.id !== id));
      set(s => ({ records: s.records.filter(r => r.id !== id) }));
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const d = require("drizzle-orm");
      const { db } = require("../db");
      const { mistakeRecords } = require("../db/schema");
      db.delete(mistakeRecords).where(d.eq(mistakeRecords.id, id)).run();
      set(s => ({ records: s.records.filter(r => r.id !== id) }));
    } catch (e: any) { set({ error: e.message }); throw e; }
    finally { set({ isLoading: false }); }
  },

  toggleReviewed: async (id) => {
    if (isWeb) {
      const now = Date.now();
      const recs = webLoadAll();
      const idx = recs.findIndex(r => r.id === id);
      if (idx !== -1) {
        const r = recs[idx];
        recs[idx] = { ...r, isReviewed: !r.isReviewed, reviewCount: r.isReviewed ? r.reviewCount : (r.reviewCount || 0) + 1, lastReviewedAt: r.isReviewed ? r.lastReviewedAt : now, updatedAt: now };
        webSaveAll(recs);
      }
      set(s => ({ records: s.records.map(r => {
        if (r.id !== id) return r;
        return { ...r, isReviewed: !r.isReviewed, reviewCount: r.isReviewed ? r.reviewCount : (r.reviewCount || 0) + 1, lastReviewedAt: r.isReviewed ? r.lastReviewedAt : now, updatedAt: now };
      })}));
      return;
    }
    try {
      const record = get().records.find(r => r.id === id); if (!record) return;
      const now = Date.now();
      const newRev = !record.isReviewed;
      const newCnt = record.isReviewed ? record.reviewCount : (record.reviewCount || 0) + 1;
      const d = require("drizzle-orm");
      const { db } = require("../db");
      const { mistakeRecords } = require("../db/schema");
      db.update(mistakeRecords).set({ isReviewed: newRev, reviewCount: newCnt, lastReviewedAt: record.isReviewed ? record.lastReviewedAt : now, updatedAt: now }).where(d.eq(mistakeRecords.id, id)).run();
      set(s => ({ records: s.records.map(r => r.id === id ? { ...r, isReviewed: newRev, reviewCount: newCnt, lastReviewedAt: record.isReviewed ? record.lastReviewedAt : now, updatedAt: now } : r) }));
    } catch (e: any) { console.error("toggleReviewed:", e); }
  },

  setFilter: (filter) => { set(st => ({ filter: { ...st.filter, ...filter } })); get().loadRecords(); },

  searchRecords: async (query) => {
    if (isWeb) {
      const q = query.toLowerCase();
      return webLoadAll().filter(r => r.problemText?.toLowerCase().includes(q) || r.analysis?.toLowerCase().includes(q) || r.subject?.toLowerCase().includes(q));
    }
    const q = `%${query.toLowerCase()}%`;
    const d = require("drizzle-orm");
    const { db } = require("../db");
    const { mistakeRecords } = require("../db/schema");
    return db.select().from(mistakeRecords).where(d.like(mistakeRecords.problemText, q)).orderBy(d.desc(mistakeRecords.createdAt)).all();
  },
}));

export const useNotebookRecords = () => useNotebookStore((s) => s.records);
export const useNotebookLoading = () => useNotebookStore((s) => s.isLoading);
export const useNotebookFilter = () => useNotebookStore((s) => s.filter);
