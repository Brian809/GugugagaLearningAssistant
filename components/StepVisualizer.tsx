import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  Animated,
  StyleSheet,
  ActivityIndicator,
  LayoutChangeEvent,
} from "react-native";
import type { SolveStep } from "../utils/solveAgent";

// ===== Constants =====

const DOT_SIZE = 28;
const GUTTER_WIDTH = 40;
const LINE_WIDTH = 2;
const GUTTER_PADDING_TOP = 18;
const DOT_CENTER = GUTTER_PADDING_TOP + DOT_SIZE / 2;

export const COLORS = {
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

// ===== Types =====

export interface StepVisualizerProps {
  steps: SolveStep[];
  currentStepIndex: number;
  status: "idle" | "solving" | "completed" | "error";
  finalAnswer?: string;
  errorMessage?: string;
}

export type StepState = "pending" | "current" | "completed" | "error";

// ===== Helpers =====

export function getStepColor(state: StepState): string {
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

export function getStepBgColor(state: StepState): string {
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

export function getStepState(
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

// ===== Status Badge Component =====

function StepStatusBadge({ state }: { state: StepState }) {
  if (state === "completed") {
    return (
      <View style={[styles.statusBadge, { backgroundColor: COLORS.completedCardBg }]}>
        <Text style={[styles.statusBadgeText, { color: COLORS.completed }]}>
          ✓ 已完成
        </Text>
      </View>
    );
  }
  if (state === "current") {
    return (
      <View style={[styles.statusBadge, { backgroundColor: COLORS.currentCardBg }]}>
        <Text style={[styles.statusBadgeText, { color: COLORS.current }]}>
          ● 执行中
        </Text>
      </View>
    );
  }
  if (state === "error") {
    return (
      <View style={[styles.statusBadge, { backgroundColor: COLORS.errorCardBg }]}>
        <Text style={[styles.statusBadgeText, { color: COLORS.error }]}>
          ! 出错
        </Text>
      </View>
    );
  }
  return null;
}

// ===== Main Component =====

export default function StepVisualizer({
  steps,
  currentStepIndex,
  status,
  finalAnswer,
  errorMessage,
}: StepVisualizerProps) {
  const scrollRef = useRef<ScrollView>(null);
  const stepLayoutY = useRef<{ [key: number]: number }>({});
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const hasFinalAnswer = !!finalAnswer;
  const showAnswerCard = status === "completed" && hasFinalAnswer;

  // ---- Pulse animation for current step ----
  useEffect(() => {
    if (status === "solving") {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.35,
            duration: 900,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [status, pulseAnim]);

  // ---- Auto-scroll to current step ----
  useEffect(() => {
    if (
      currentStepIndex >= 0 &&
      stepLayoutY.current[currentStepIndex] != null
    ) {
      scrollRef.current?.scrollTo({
        y: Math.max(0, stepLayoutY.current[currentStepIndex] - 80),
        animated: true,
      });
    }
  }, [currentStepIndex, status]);

  const handleLayout = (index: number, event: LayoutChangeEvent) => {
    stepLayoutY.current[index] = event.nativeEvent.layout.y;
  };

  // ---- Empty / idle state ----
  if (status === "idle" && steps.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <View style={styles.emptyIconContainer}>
          <Text style={styles.emptyIcon}>~</Text>
        </View>
        <Text style={styles.emptyText}>等待解题开始...</Text>
        <Text style={styles.emptySubtext}>
          输入数学问题或上传题目图片开始解题
        </Text>
      </View>
    );
  }

  // ---- Loading state (solving but no steps yet) ----
  if (status === "solving" && steps.length === 0) {
    return (
      <View style={styles.centeredContainer}>
        <ActivityIndicator size="large" color={COLORS.current} />
        <Text style={styles.loadingText}>正在解题...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        removeClippedSubviews={false}
      >
        {/* ---- Step Cards ---- */}
        {steps.map((step, index) => {
          const state = getStepState(index, currentStepIndex, status);
          const color = getStepColor(state);
          const bgColor = getStepBgColor(state);
          const prevState =
            index > 0
              ? getStepState(index - 1, currentStepIndex, status)
              : null;
          const prevColor = prevState ? getStepColor(prevState) : undefined;
          const isCurrent = state === "current";
          const isLast = index === steps.length - 1;
          const showLowerLine = !isLast || (isLast && showAnswerCard);

          return (
            <View
              key={step.stepNumber}
              style={styles.stepRow}
              onLayout={(e) => handleLayout(index, e)}
            >
              {/* ---- Timeline Column ---- */}
              <View style={styles.timelineGutter}>
                {/* Upper line segment: from prev dot to this dot */}
                {index > 0 && prevColor && (
                  <View
                    style={[
                      styles.lineSegment,
                      {
                        top: 0,
                        bottom: DOT_CENTER,
                        backgroundColor: prevColor,
                      },
                    ]}
                  />
                )}
                {/* Lower line segment: from this dot to next / final answer */}
                {showLowerLine && (
                  <View
                    style={[
                      styles.lineSegment,
                      {
                        top: DOT_CENTER,
                        bottom: 0,
                        backgroundColor: color,
                      },
                    ]}
                  />
                )}
                {/* Timeline dot */}
                {isCurrent ? (
                  <Animated.View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: color,
                        opacity: pulseAnim,
                        transform: [
                          {
                            scale: pulseAnim.interpolate({
                              inputRange: [0.35, 1],
                              outputRange: [0.88, 1.08],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <Text style={styles.dotText}>{step.stepNumber}</Text>
                  </Animated.View>
                ) : (
                  <View style={[styles.dot, { backgroundColor: color }]}>
                    <Text style={styles.dotText}>
                      {state === "completed" ? "✓" : step.stepNumber}
                    </Text>
                  </View>
                )}
              </View>

              {/* ---- Step Card ---- */}
              <View
                style={[
                  styles.card,
                  state === "pending" && styles.cardPending,
                  state === "error" && styles.cardErrorBorder,
                  state === "completed" && styles.cardCompletedBorder,
                  isCurrent && status === "solving" && styles.cardCurrentBorder,
                ]}
              >
                {/* Status badge */}
                <StepStatusBadge state={state} />

                {/* Description */}
                <Text
                  style={[
                    styles.stepDescription,
                    state === "pending" && styles.textMuted,
                  ]}
                  numberOfLines={0}
                >
                  {step.description}
                </Text>

                {/* LaTeX formula (displayed as plain text — no rendering) */}
                {step.latexFormula && (
                  <Text
                    style={[
                      styles.stepFormula,
                      state === "pending" && styles.textMuted,
                    ]}
                  >
                    {step.latexFormula}
                  </Text>
                )}

                {/* Expression */}
                {step.expression && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>表达式</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        state === "pending" && styles.textMuted,
                      ]}
                    >
                      {step.expression}
                    </Text>
                  </View>
                )}

                {/* Result */}
                {step.result && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>结果</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        styles.resultValue,
                        state === "pending" && styles.textMuted,
                      ]}
                    >
                      → {step.result}
                    </Text>
                  </View>
                )}

                {/* GeoGebra command */}
                {step.geogebraCommand && (
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>GeoGebra</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        styles.geogebraValue,
                        state === "pending" && styles.textMuted,
                      ]}
                      numberOfLines={2}
                      ellipsizeMode="tail"
                    >
                      {step.geogebraCommand}
                    </Text>
                  </View>
                )}

                {/* Error message inside error step */}
                {state === "error" && errorMessage && (
                  <View style={styles.errorContainer}>
                    <Text style={styles.errorMessageText}>{errorMessage}</Text>
                  </View>
                )}
              </View>
            </View>
          );
        })}

        {/* ---- Final Answer Card ---- */}
        {showAnswerCard && (
          <View style={styles.stepRow}>
            <View style={styles.timelineGutter}>
              {/* Connecting line from last step */}
              {steps.length > 0 && (
                <View
                  style={[
                    styles.lineSegment,
                    {
                      top: 0,
                      bottom: DOT_CENTER,
                      backgroundColor: COLORS.completed,
                    },
                  ]}
                />
              )}
              {/* Checkmark dot */}
              <View style={[styles.dot, { backgroundColor: COLORS.completed }]}>
                <Text style={styles.dotText}>✓</Text>
              </View>
            </View>
            <View style={[styles.card, styles.finalAnswerCard]}>
              <Text style={styles.finalAnswerLabel}>最终答案</Text>
              <Text style={styles.finalAnswerText}>{finalAnswer}</Text>
            </View>
          </View>
        )}

        {/* ---- Bottom padding ---- */}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  // Layout
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 12,
  },
  bottomSpacer: {
    height: 20,
  },

  // Centered states
  centeredContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 40,
  },
  emptyIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F0F0F0",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 28,
    color: "#BBB",
    fontWeight: "300",
  },
  emptyText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#888",
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#B0B0B0",
    textAlign: "center",
    lineHeight: 20,
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
  },

  // Step row
  stepRow: {
    flexDirection: "row",
    marginBottom: 12,
  },

  // Timeline
  timelineGutter: {
    width: GUTTER_WIDTH,
    alignItems: "center",
    alignSelf: "stretch",
    paddingTop: GUTTER_PADDING_TOP,
    position: "relative",
  },
  lineSegment: {
    position: "absolute",
    width: LINE_WIDTH,
    left: (GUTTER_WIDTH - LINE_WIDTH) / 2,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
    // Subtle shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  dotText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
    includeFontPadding: false,
  },

  // Card base
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginLeft: 12,
    // Shadow (matching index.tsx card pattern)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: COLORS.cardBorder,
  },
  cardPending: {
    opacity: 0.6,
  },
  cardErrorBorder: {
    borderColor: COLORS.error,
    borderWidth: 1,
  },
  cardCompletedBorder: {
    borderColor: COLORS.completed,
  },
  cardCurrentBorder: {
    borderColor: COLORS.current,
    borderWidth: 1,
  },

  // Status badge
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 10,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },

  // Step description
  stepDescription: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textPrimary,
    lineHeight: 22,
    marginBottom: 8,
  },

  // LaTeX formula (plain text display)
  stepFormula: {
    fontSize: 16,
    fontWeight: "400",
    color: COLORS.textSecondary,
    lineHeight: 24,
    fontFamily: "monospace",
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginBottom: 8,
    overflow: "hidden",
  },

  // Info rows (expression, result, geogebra)
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.textSecondary,
    width: 60,
    paddingTop: 2,
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textPrimary,
    lineHeight: 20,
  },
  resultValue: {
    fontWeight: "600",
    color: COLORS.textPrimary,
  },
  geogebraValue: {
    fontFamily: "monospace",
    fontSize: 12,
    color: "#555",
    backgroundColor: "#F5F5F5",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },

  // Text modifiers
  textMuted: {
    color: COLORS.textMuted,
  },

  // Error section inside card
  errorContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.errorCardBg,
  },
  errorMessageText: {
    fontSize: 13,
    color: COLORS.error,
    lineHeight: 18,
  },

  // Final answer card
  finalAnswerCard: {
    backgroundColor: COLORS.finalAnswerBg,
    borderColor: COLORS.completed,
    borderWidth: 1.5,
  },
  finalAnswerLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.finalAnswerText,
    letterSpacing: 0.5,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  finalAnswerText: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.finalAnswerText,
    lineHeight: 26,
  },
});
