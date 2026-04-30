import { create } from "zustand";
import { db } from "../db";
import { mistakeRecords, MistakeRecord, NewMistakeRecord } from "../db/schema";
import { eq, like, and, or, desc } from "drizzle-orm";

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

export const useNotebookStore = create<NotebookState>((set, get) => ({
  records: [],
  isLoading: false,
  error: null,
  filter: {},

  loadRecords: async () => {
    set({ isLoading: true, error: null });
    try {
      const { filter } = get();
      const conditions: ReturnType<typeof eq>[] = [];

      if (filter.subject) {
        conditions.push(eq(mistakeRecords.subject, filter.subject));
      }
      if (filter.isReviewed !== undefined) {
        conditions.push(eq(mistakeRecords.isReviewed, filter.isReviewed));
      }
      if (filter.tag) {
        conditions.push(like(mistakeRecords.tags, `%${filter.tag}%`));
      }

      const records: MistakeRecord[] =
        conditions.length > 0
          ? (db
              .select()
              .from(mistakeRecords)
              .where(and(...conditions))
              .orderBy(desc(mistakeRecords.createdAt))
              .all() as MistakeRecord[])
          : (db
              .select()
              .from(mistakeRecords)
              .orderBy(desc(mistakeRecords.createdAt))
              .all() as MistakeRecord[]);
      set({ records });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to load mistake records:", error);
    } finally {
      set({ isLoading: false });
    }
  },

  addRecord: async (record: NewMistakeRecord) => {
    set({ isLoading: true, error: null });
    try {
      const inserted = db
        .insert(mistakeRecords)
        .values(record)
        .returning()
        .get() as MistakeRecord;
      set((state) => ({
        records: [inserted, ...state.records],
      }));
      return inserted.id;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to add mistake record:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  updateRecord: async (id: string, updates: Partial<MistakeRecord>) => {
    set({ isLoading: true, error: null });
    try {
      const now = Date.now();
      db.update(mistakeRecords)
        .set({ ...updates, updatedAt: now })
        .where(eq(mistakeRecords.id, id))
        .run();

      set((state) => ({
        records: state.records.map((r) =>
          r.id === id ? { ...r, ...updates, updatedAt: now } : r,
        ),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to update mistake record:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  deleteRecord: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      db.delete(mistakeRecords).where(eq(mistakeRecords.id, id)).run();
      set((state) => ({
        records: state.records.filter((r) => r.id !== id),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to delete mistake record:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  toggleReviewed: async (id: string) => {
    set({ isLoading: true, error: null });
    try {
      const record = get().records.find((r) => r.id === id);
      if (!record) throw new Error("Record not found");

      const now = Date.now();
      const currentlyReviewed = record.isReviewed;

      if (currentlyReviewed) {
        db.update(mistakeRecords)
          .set({ isReviewed: false, updatedAt: now })
          .where(eq(mistakeRecords.id, id))
          .run();
      } else {
        const newCount = (record.reviewCount ?? 0) + 1;
        db.update(mistakeRecords)
          .set({
            isReviewed: true,
            reviewCount: newCount,
            lastReviewedAt: now,
            updatedAt: now,
          })
          .where(eq(mistakeRecords.id, id))
          .run();
      }

      set((state) => ({
        records: state.records.map((r) =>
          r.id === id
            ? {
                ...r,
                isReviewed: !currentlyReviewed,
                reviewCount: currentlyReviewed
                  ? r.reviewCount
                  : (r.reviewCount ?? 0) + 1,
                lastReviewedAt: currentlyReviewed
                  ? r.lastReviewedAt
                  : now,
                updatedAt: now,
              }
            : r,
        ),
      }));
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      set({ error: errorMessage });
      console.error("Failed to toggle review status:", error);
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  setFilter: (filter: Partial<NotebookFilter>) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
    get().loadRecords();
  },

  searchRecords: async (query: string) => {
    try {
      const results = db
        .select()
        .from(mistakeRecords)
        .where(
          or(
            like(mistakeRecords.problemText, `%${query}%`),
            like(mistakeRecords.analysis, `%${query}%`),
          ),
        )
        .orderBy(desc(mistakeRecords.createdAt))
        .all() as MistakeRecord[];
      return results;
    } catch (error) {
      console.error("Failed to search mistake records:", error);
      throw error;
    }
  },
}));

export const useNotebookRecords = () =>
  useNotebookStore((s) => s.records);
export const useNotebookLoading = () =>
  useNotebookStore((s) => s.isLoading);
export const useNotebookFilter = () =>
  useNotebookStore((s) => s.filter);
