import { describe, it, expect } from "bun:test";
import {
  solveProblem,
  imageToBase64,
  SolveStep,
  SolveResult,
  StepCallback,
} from "../utils/solveAgent";

describe("solveAgent", () => {
  it("should export solveProblem function", () => {
    expect(typeof solveProblem).toBe("function");
  });

  it("should export imageToBase64 function", () => {
    expect(typeof imageToBase64).toBe("function");
  });

  it("should validate SolveStep type structure", () => {
    // Minimal step
    const step: SolveStep = {
      stepNumber: 1,
      description: "test step",
    };
    expect(step.stepNumber).toBe(1);
    expect(step.description).toBe("test step");
    expect(step.expression).toBeUndefined();
    expect(step.result).toBeUndefined();
    expect(step.latexFormula).toBeUndefined();
    expect(step.geogebraCommand).toBeUndefined();

    // Full step with all fields
    const fullStep: SolveStep = {
      stepNumber: 2,
      description: "full step",
      expression: "2 + 2 = 4",
      result: "4",
      latexFormula: "2 + 2 = 4",
      geogebraCommand: "Line((0,0), (1,1))",
    };
    expect(fullStep.stepNumber).toBe(2);
    expect(fullStep.expression).toBe("2 + 2 = 4");
    expect(fullStep.result).toBe("4");
    expect(fullStep.latexFormula).toBe("2 + 2 = 4");
    expect(fullStep.geogebraCommand).toBe("Line((0,0), (1,1))");
  });

  it("should validate SolveResult type structure", () => {
    const steps: SolveStep[] = [
      { stepNumber: 1, description: "step 1" },
      { stepNumber: 2, description: "step 2" },
    ];
    const result: SolveResult = {
      finalAnswer: "x = 5",
      steps,
      solutionType: "代数",
    };
    expect(result.finalAnswer).toBe("x = 5");
    expect(result.steps).toHaveLength(2);
    expect(result.solutionType).toBe("代数");
  });

  it("should validate StepCallback type signature", () => {
    const callback: StepCallback = async (step: SolveStep) => {
      return { success: true };
    };
    expect(typeof callback).toBe("function");
  });

  it("should accept StepCallback returning error", () => {
    const callback: StepCallback = async (step: SolveStep) => {
      return { success: false, error: "computation failed" };
    };
    expect(typeof callback).toBe("function");
  });
});
