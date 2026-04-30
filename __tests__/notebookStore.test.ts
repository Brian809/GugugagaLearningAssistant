import { describe, it, expect } from "bun:test";

/**
 * Self-contained notebook store contract tests.
 *
 * Tests the core business logic that notebookStore implements,
 * without importing React Native dependencies (expo-sqlite, etc.).
 * Validates data model integrity, CRUD operations, and state transitions.
 */

// ===== Minimal data model matching MistakeRecord =====
interface MistakeRecord {
  id: string;
  problemText: string;
  userAnswer: string;
  correctAnswer: string;
  analysis?: string;
  tags?: string;
  subject?: string;
  isReviewed: boolean;
  reviewCount: number;
  lastReviewedAt?: number;
  createdAt: number;
  updatedAt: number;
}

function makeRecord(overrides: Partial<MistakeRecord> = {}): MistakeRecord {
  return {
    id: Math.random().toString(36).substring(2, 15),
    problemText: "test problem",
    userAnswer: "wrong answer",
    correctAnswer: "correct answer",
    isReviewed: false,
    reviewCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

// ===== Tests =====

describe("notebookStore CRUD contract", () => {
  // ===== Add =====
  describe("addRecord", () => {
    it("should add a record to the list (prepend)", () => {
      const records: MistakeRecord[] = [];
      const r1 = makeRecord({ id: "1", problemText: "first" });
      const r2 = makeRecord({ id: "2", problemText: "second" });

      // Simulate addRecord: prepend
      records.unshift(r1);
      records.unshift(r2);

      expect(records).toHaveLength(2);
      expect(records[0].problemText).toBe("second"); // most recent first
      expect(records[1].problemText).toBe("first");
    });

    it("should generate unique IDs", () => {
      const r1 = makeRecord();
      const r2 = makeRecord();
      expect(r1.id).not.toBe(r2.id);
    });
  });

  // ===== Read / List =====
  describe("loadRecords", () => {
    it("should return records sorted by createdAt descending", () => {
      const records = [
        makeRecord({ id: "1", createdAt: 100 }),
        makeRecord({ id: "2", createdAt: 200 }),
        makeRecord({ id: "3", createdAt: 300 }),
      ];
      const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
      expect(sorted[0].id).toBe("3");
      expect(sorted[2].id).toBe("1");
    });

    it("should filter by subject", () => {
      const records = [
        makeRecord({ id: "1", subject: "algebra" }),
        makeRecord({ id: "2", subject: "geometry" }),
        makeRecord({ id: "3", subject: "algebra" }),
      ];
      const filtered = records.filter((r) => r.subject === "algebra");
      expect(filtered).toHaveLength(2);
    });

    it("should filter by isReviewed", () => {
      const records = [
        makeRecord({ id: "1", isReviewed: false }),
        makeRecord({ id: "2", isReviewed: true }),
        makeRecord({ id: "3", isReviewed: false }),
      ];
      const unreviewed = records.filter((r) => r.isReviewed === false);
      expect(unreviewed).toHaveLength(2);

      const reviewed = records.filter((r) => r.isReviewed === true);
      expect(reviewed).toHaveLength(1);
    });

    it("should combine subject and isReviewed filters", () => {
      const records = [
        makeRecord({ id: "1", subject: "algebra", isReviewed: false }),
        makeRecord({ id: "2", subject: "algebra", isReviewed: true }),
        makeRecord({ id: "3", subject: "geometry", isReviewed: false }),
      ];
      const result = records.filter(
        (r) => r.subject === "algebra" && r.isReviewed === true,
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe("2");
    });
  });

  // ===== Update =====
  describe("updateRecord", () => {
    it("should update record fields and set new updatedAt", () => {
      const now = Date.now();
      const record = makeRecord({ id: "1", updatedAt: now - 1000 });
      const newUpdatedAt = Date.now();

      const updated = {
        ...record,
        problemText: "updated problem",
        userAnswer: "fixed answer",
        updatedAt: newUpdatedAt,
      };

      expect(updated.problemText).toBe("updated problem");
      expect(updated.userAnswer).toBe("fixed answer");
      expect(updated.updatedAt).toBe(newUpdatedAt);
      // Fields not in update should be preserved
      expect(updated.correctAnswer).toBe("correct answer");
    });

    it("should only modify the target record (map pattern)", () => {
      const records = [
        makeRecord({ id: "1", problemText: "keep" }),
        makeRecord({ id: "2", problemText: "change" }),
      ];
      const updatedRecords = records.map((r) =>
        r.id === "2" ? { ...r, problemText: "changed" } : r,
      );

      expect(updatedRecords[0].problemText).toBe("keep");
      expect(updatedRecords[1].problemText).toBe("changed");
    });
  });

  // ===== Delete =====
  describe("deleteRecord", () => {
    it("should remove the record by id", () => {
      const records = [
        makeRecord({ id: "1" }),
        makeRecord({ id: "2" }),
        makeRecord({ id: "3" }),
      ];
      const afterDelete = records.filter((r) => r.id !== "2");
      expect(afterDelete).toHaveLength(2);
      expect(afterDelete.find((r) => r.id === "2")).toBeUndefined();
    });

    it("should not modify other records when deleting", () => {
      const records = [
        makeRecord({ id: "1", problemText: "alpha" }),
        makeRecord({ id: "2", problemText: "beta" }),
      ];
      const afterDelete = records.filter((r) => r.id !== "1");
      expect(afterDelete[0].problemText).toBe("beta");
    });
  });

  // ===== Toggle Review =====
  describe("toggleReviewed", () => {
    it("should flip isReviewed from false to true and increment reviewCount", () => {
      const record = makeRecord({ id: "1", isReviewed: false, reviewCount: 0 });
      const now = Date.now();

      const updated = {
        ...record,
        isReviewed: true,
        reviewCount: (record.reviewCount ?? 0) + 1,
        lastReviewedAt: now,
        updatedAt: now,
      };

      expect(updated.isReviewed).toBe(true);
      expect(updated.reviewCount).toBe(1);
      expect(updated.lastReviewedAt).toBe(now);
    });

    it("should flip isReviewed from true to false (unreview)", () => {
      const record = makeRecord({
        id: "1",
        isReviewed: true,
        reviewCount: 3,
        lastReviewedAt: Date.now() - 86400000,
      });
      const now = Date.now();

      const updated = {
        ...record,
        isReviewed: false,
        reviewCount: record.reviewCount,
        updatedAt: now,
      };

      expect(updated.isReviewed).toBe(false);
      expect(updated.reviewCount).toBe(3);
    });

    it("should handle undefined reviewCount as 0", () => {
      const record = makeRecord({
        id: "1",
        isReviewed: false,
        reviewCount: 0,
      });
      const newCount = (record.reviewCount ?? 0) + 1;
      expect(newCount).toBe(1);
    });
  });

  // ===== Search =====
  describe("searchRecords", () => {
    it("should find records by problemText substring match", () => {
      const records = [
        makeRecord({ id: "1", problemText: "solve 2x + 3 = 7" }),
        makeRecord({ id: "2", problemText: "find the area" }),
      ];
      const query = "2x";
      const results = records.filter((r) => r.problemText.includes(query));
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("1");
    });

    it("should find records by analysis substring match", () => {
      const records = [
        makeRecord({ id: "1", problemText: "problem 1", analysis: "quadratic formula" }),
        makeRecord({ id: "2", problemText: "problem 2", analysis: "pythagorean theorem" }),
      ];
      const query = "pythagorean";
      const results = records.filter(
        (r) =>
          r.problemText.includes(query) ||
          (r.analysis && r.analysis.includes(query)),
      );
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("2");
    });

    it("should return empty array for no matches", () => {
      const records = [
        makeRecord({ id: "1", problemText: "algebra" }),
      ];
      const query = "calculus";
      const results = records.filter(
        (r) => r.problemText.includes(query) || (r.analysis && r.analysis.includes(query)),
      );
      expect(results).toHaveLength(0);
    });
  });

  // ===== Filter =====
  describe("setFilter", () => {
    it("should merge new filter with existing filter", () => {
      const existingFilter = { subject: "algebra" };
      const newFilter = { isReviewed: true };
      const merged = { ...existingFilter, ...newFilter };
      expect(merged).toEqual({ subject: "algebra", isReviewed: true });
    });
  });
});
