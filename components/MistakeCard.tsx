import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { MistakeRecord } from "../db/schema";

interface MistakeCardProps {
  record: MistakeRecord;
  onEdit?: (record: MistakeRecord) => void;
  onDelete?: (record: MistakeRecord) => void;
  onToggleReview?: (record: MistakeRecord) => void;
  onSolve?: (record: MistakeRecord) => void;
}

const SUBJECT_COLORS: Record<string, string> = {
  algebra: "#007AFF",
  geometry: "#34C759",
  trigonometry: "#FF9500",
  calculus: "#AF52DE",
  statistics: "#FF2D55",
};

const SUBJECT_LABELS: Record<string, string> = {
  algebra: "代数",
  geometry: "几何",
  trigonometry: "三角",
  calculus: "微积分",
  statistics: "统计",
};

const DEFAULT_SUBJECT_COLOR = "#8E8E93";

function getSubjectColor(subject: string | null): string {
  if (!subject) return DEFAULT_SUBJECT_COLOR;
  return SUBJECT_COLORS[subject.toLowerCase()] ?? DEFAULT_SUBJECT_COLOR;
}

function getSubjectLabel(subject: string | null): string {
  if (!subject) return "其他";
  return SUBJECT_LABELS[subject.toLowerCase()] ?? subject;
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseTags(tags: string | null): string[] {
  if (!tags) return [];
  try {
    const parsed = JSON.parse(tags);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // not JSON, fall through to comma-separated
  }
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
}

export default function MistakeCard({
  record,
  onEdit,
  onDelete,
  onToggleReview,
  onSolve,
}: MistakeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const tags = parseTags(record.tags);
  const subjectColor = getSubjectColor(record.subject);
  const subjectLabel = getSubjectLabel(record.subject);

  const handleToggle = () => setExpanded((prev) => !prev);

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={handleToggle}
      activeOpacity={0.7}
    >
      {/* Collapsed View */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text
            style={styles.problemText}
            numberOfLines={expanded ? undefined : 2}
          >
            {record.problemText}
          </Text>
          <View style={styles.badgeRow}>
            {record.subject && (
              <View
                style={[styles.subjectBadge, { backgroundColor: subjectColor }]}
              >
                <Text style={styles.subjectBadgeText}>{subjectLabel}</Text>
              </View>
            )}
            <View
              style={[
                styles.reviewBadge,
                {
                  backgroundColor: record.isReviewed ? "#E8F5E9" : "#FFF3E0",
                },
              ]}
            >
              <Ionicons
                name={record.isReviewed ? "checkmark-circle" : "time"}
                size={14}
                color={record.isReviewed ? "#2E7D32" : "#E65100"}
              />
              <Text
                style={[
                  styles.reviewBadgeText,
                  { color: record.isReviewed ? "#2E7D32" : "#E65100" },
                ]}
              >
                {record.isReviewed ? "已复习 ✓" : "待复习"}
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.dateText}>{formatDate(record.createdAt)}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={20}
            color="#999"
          />
        </View>
      </View>

      {/* Expanded View */}
      {expanded && (
        <View style={styles.expandedContent}>
          <View style={styles.divider} />

          {record.userAnswer ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>你的答案</Text>
              <Text style={styles.fieldValueWrong}>{record.userAnswer}</Text>
            </View>
          ) : null}

          {record.correctAnswer ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>正确答案</Text>
              <Text style={styles.fieldValueCorrect}>
                {record.correctAnswer}
              </Text>
            </View>
          ) : null}

          {record.analysis ? (
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>分析</Text>
              <Text style={styles.fieldValue}>{record.analysis}</Text>
            </View>
          ) : null}

          {tags.length > 0 ? (
            <View style={styles.tagsRow}>
              {tags.map((tag, index) => (
                <View key={`${tag}-${index}`} style={styles.tagChip}>
                  <Text style={styles.tagText}>{tag}</Text>
                </View>
              ))}
            </View>
          ) : null}

          <View style={styles.actionRow}>
            {onSolve ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onSolve(record)}
              >
                <Ionicons name="create-outline" size={16} color="#007AFF" />
                <Text style={styles.actionButtonText}>重新解题</Text>
              </TouchableOpacity>
            ) : null}
            {onToggleReview ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onToggleReview(record)}
              >
                <Ionicons
                  name={
                    record.isReviewed
                      ? "close-circle-outline"
                      : "checkmark-circle-outline"
                  }
                  size={16}
                  color="#34C759"
                />
                <Text style={[styles.actionButtonText, { color: "#34C759" }]}>
                  {record.isReviewed ? "取消复习" : "标记已复习"}
                </Text>
              </TouchableOpacity>
            ) : null}
            {onEdit ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onEdit(record)}
              >
                <Ionicons name="pencil-outline" size={16} color="#8E8E93" />
                <Text style={[styles.actionButtonText, { color: "#8E8E93" }]}>
                  编辑
                </Text>
              </TouchableOpacity>
            ) : null}
            {onDelete ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onDelete(record)}
              >
                <Ionicons name="trash-outline" size={16} color="#FF3B30" />
                <Text style={[styles.actionButtonText, { color: "#FF3B30" }]}>
                  删除
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 8,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  headerLeft: {
    flex: 1,
    marginRight: 12,
  },
  headerRight: {
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  problemText: {
    fontSize: 15,
    color: "#333",
    lineHeight: 22,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    gap: 8,
  },
  subjectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  subjectBadgeText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "500",
  },
  reviewBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 4,
  },
  reviewBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },
  dateText: {
    fontSize: 12,
    color: "#999",
  },
  expandedContent: {
    marginTop: 12,
  },
  divider: {
    height: 1,
    backgroundColor: "#f0f0f0",
    marginBottom: 12,
  },
  fieldRow: {
    marginBottom: 10,
  },
  fieldLabel: {
    fontSize: 12,
    color: "#999",
    marginBottom: 4,
    fontWeight: "500",
  },
  fieldValue: {
    fontSize: 14,
    color: "#333",
    lineHeight: 20,
  },
  fieldValueWrong: {
    fontSize: 14,
    color: "#D32F2F",
    lineHeight: 20,
  },
  fieldValueCorrect: {
    fontSize: 14,
    color: "#2E7D32",
    lineHeight: 20,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  tagChip: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  tagText: {
    fontSize: 12,
    color: "#666",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 4,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#f8f8f8",
  },
  actionButtonText: {
    fontSize: 13,
    color: "#007AFF",
    fontWeight: "500",
  },
});
