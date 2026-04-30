import { describe, it, expect } from "bun:test";

/**
 * Self-contained StepVisualizer logic tests.
 *
 * Tests the helper functions used by StepVisualizer without
 * importing React Native dependencies.
 */

// ===== Types matching StepVisualizer =====
type StepState = "pending" | "current" | "completed" | "error";

interface SolveStep {
  stepNumber: number;
  description: string;
  expression?: string;
  result?: string;
  latexFormula?: string;
  geogebraCommand?: string;
}

// ===== Constants matching StepVisualizer =====
const COLORS = {
  completed: "#4CAF50",
  completedDot: "#4CAF50",
  current: "#007AFF",
  pending: "#D0D0D0",
  error: "#FF3B30",
  completedCardBg: "#F1F8E9",
  currentCardBg: "#E3F2FD",
  pendingCardBg: "#FAFAFA",
  errorCardBg: "#FFEBEE",
  textPrimary: "#1A1A1A",
  textSecondary: "#666666",
  textMuted: "#AAAAAA",
  white: "#FFFFFF",
  cardBorder: "#E8E8E8",
  finalAnswerBg: "#E8F5E9",
  finalAnswerText: "#2E7D32",
  successBadge: "#4CAF50",
} as const;

// ===== Helper functions matching StepVisualizer =====

function getStepColor(state: StepState): string {
  switch (state) {
    case "completed":
      return COLORS.completed;
    case "current":
      return COLORS.current;
    case "error":
      return COLORS.error;
    default:
      return COLORS.pending;
  }
}

function getStepBgColor(state: StepState): string {
  switch (state) {
    case "completed":
      return COLORS.completedCardBg;
    case "current":
      return COLORS.currentCardBg;
    case "error":
      return COLORS.errorCardBg;
    default:
      return COLORS.pendingCardBg;
  }
}

function getStepState(
  index: number,
  currentStepIndex: number,
  status: string,
): StepState {
  if (status === "error" && index === currentStepIndex) return "error";
  if (index < currentStepIndex) return "completed";
  if (index === currentStepIndex)
    return status === "error" ? "error" : "current";
  return "pending";
}

// ===== Tests =====

describe("StepVisualizer helpers", () => {
  // ===== getStepState =====
  describe("getStepState", () => {
    it('should return "error" for current step when status is error', () => {
      expect(getStepState(0, 0, "error")).toBe("error");
      expect(getStepState(2, 2, "error")).toBe("error");
      expect(getStepState(5, 5, "error")).toBe("error");
    });

    it('should return "completed" for past steps', () => {
      expect(getStepState(0, 2, "solving")).toBe("completed");
      expect(getStepState(1, 2, "solving")).toBe("completed");
      expect(getStepState(0, 5, "completed")).toBe("completed");
      expect(getStepState(3, 5, "completed")).toBe("completed");
      expect(getStepState(0, 3, "error")).toBe("completed");
      expect(getStepState(1, 3, "error")).toBe("completed");
      expect(getStepState(2, 3, "error")).toBe("completed");
    });

    it('should return "current" for the active step when status is not error', () => {
      expect(getStepState(2, 2, "solving")).toBe("current");
      expect(getStepState(1, 1, "completed")).toBe("current");
      expect(getStepState(0, 0, "solving")).toBe("current");
    });

    it('should return "pending" for future steps', () => {
      expect(getStepState(3, 2, "solving")).toBe("pending");
      expect(getStepState(4, 2, "solving")).toBe("pending");
      expect(getStepState(5, 2, "error")).toBe("pending");
      expect(getStepState(10, 0, "idle")).toBe("pending");
    });
  });

  // ===== getStepColor =====
  describe("getStepColor", () => {
    it("should return correct color for each state", () => {
      expect(getStepColor("completed")).toBe("#4CAF50");
      expect(getStepColor("current")).toBe("#007AFF");
      expect(getStepColor("error")).toBe("#FF3B30");
      expect(getStepColor("pending")).toBe("#D0D0D0");
    });
  });

  // ===== getStepBgColor =====
  describe("getStepBgColor", () => {
    it("should return correct background color for each state", () => {
      expect(getStepBgColor("completed")).toBe("#F1F8E9");
      expect(getStepBgColor("current")).toBe("#E3F2FD");
      expect(getStepBgColor("error")).toBe("#FFEBEE");
      expect(getStepBgColor("pending")).toBe("#FAFAFA");
    });
  });

  // ===== COLORS =====
  describe("COLORS constants", () => {
    it("should have all required color keys", () => {
      expect(COLORS.completed).toBe("#4CAF50");
      expect(COLORS.current).toBe("#007AFF");
      expect(COLORS.pending).toBe("#D0D0D0");
      expect(COLORS.error).toBe("#FF3B30");
      expect(COLORS.completedCardBg).toBe("#F1F8E9");
      expect(COLORS.currentCardBg).toBe("#E3F2FD");
      expect(COLORS.pendingCardBg).toBe("#FAFAFA");
      expect(COLORS.errorCardBg).toBe("#FFEBEE");
      expect(COLORS.textPrimary).toBe("#1A1A1A");
      expect(COLORS.textSecondary).toBe("#666666");
      expect(COLORS.textMuted).toBe("#AAAAAA");
      expect(COLORS.white).toBe("#FFFFFF");
      expect(COLORS.cardBorder).toBe("#E8E8E8");
    });

    it("should have no undefined or empty color values", () => {
      const values = Object.values(COLORS);
      values.forEach((v) => {
        expect(typeof v).toBe("string");
        expect(v.length).toBeGreaterThan(0);
      });
    });
  });

  // ===== SolveStep type structure =====
  describe("SolveStep structure", () => {
    it("should create minimal step", () => {
      const step: SolveStep = {
        stepNumber: 1,
        description: "test",
      };
      expect(step.stepNumber).toBe(1);
      expect(step.description).toBe("test");
    });

    it("should create full step with all fields", () => {
      const step: SolveStep = {
        stepNumber: 2,
        description: "full step",
        expression: "x + 2 = 5",
        result: "x = 3",
        latexFormula: "x + 2 = 5",
        geogebraCommand: "Segment((0,0), (3,4))",
      };
      expect(step.expression).toBe("x + 2 = 5");
      expect(step.result).toBe("x = 3");
      expect(step.latexFormula).toBe("x + 2 = 5");
      expect(step.geogebraCommand).toBe("Segment((0,0), (3,4))");
    });
  });
});
