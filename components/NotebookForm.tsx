import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Switch,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNotebookStore } from "../stores/notebookStore";
import { MistakeRecord } from "../db/schema";

const SUBJECTS = ["代数", "几何", "函数", "概率", "其他"];

interface NotebookFormProps {
  visible: boolean;
  onClose: () => void;
  editRecord?: MistakeRecord;
  prefill?: {
    problemText?: string;
    correctAnswer?: string;
    userAnswer?: string;
    analysis?: string;
  };
}

export default function NotebookForm({
  visible,
  onClose,
  editRecord,
  prefill,
}: NotebookFormProps) {
  const addRecord = useNotebookStore((s) => s.addRecord);
  const updateRecord = useNotebookStore((s) => s.updateRecord);

  const isEditing = editRecord !== undefined;

  const [problemText, setProblemText] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("");
  const [analysis, setAnalysis] = useState("");
  const [subject, setSubject] = useState("");
  const [isReviewed, setIsReviewed] = useState(false);
  const [tagsInput, setTagsInput] = useState("");

  // validation state
  const [errors, setErrors] = useState<{
    problemText?: string;
    userAnswer?: string;
    correctAnswer?: string;
  }>({});

  // Reset form when modal opens
  useEffect(() => {
    if (visible) {
      if (editRecord) {
        setProblemText(editRecord.problemText);
        setUserAnswer(editRecord.userAnswer);
        setCorrectAnswer(editRecord.correctAnswer);
        setAnalysis(editRecord.analysis ?? "");
        setSubject(editRecord.subject ?? "");
        setIsReviewed(editRecord.isReviewed ?? false);
        setTagsInput(editRecord.tags ?? "");
      } else {
        setProblemText(prefill?.problemText ?? "");
        setUserAnswer(prefill?.userAnswer ?? "");
        setCorrectAnswer(prefill?.correctAnswer ?? "");
        setAnalysis(prefill?.analysis ?? "");
        setSubject("");
        setIsReviewed(false);
        setTagsInput("");
      }
      setErrors({});
    }
  }, [visible, editRecord, prefill]);

  const validate = (): boolean => {
    const newErrors: typeof errors = {};
    if (!problemText.trim()) {
      newErrors.problemText = "请输入题目内容";
    }
    if (!userAnswer.trim()) {
      newErrors.userAnswer = "请输入你的答案";
    }
    if (!correctAnswer.trim()) {
      newErrors.correctAnswer = "请输入正确答案";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    try {
      const recordData = {
        problemText: problemText.trim(),
        userAnswer: userAnswer.trim(),
        correctAnswer: correctAnswer.trim(),
        analysis: analysis.trim() || undefined,
        subject: subject || undefined,
        isReviewed,
        tags: tagsInput.trim() || undefined,
      };

      if (isEditing && editRecord) {
        await updateRecord(editRecord.id, recordData);
      } else {
        await addRecord(recordData);
      }
      onClose();
    } catch {
      Alert.alert("保存失败", "无法保存错题记录，请重试");
    }
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEditing ? "编辑错题" : "添加错题"}
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          {/* Form */}
          <ScrollView style={styles.form}>
            {/* 题目内容 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>题目内容</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  errors.problemText && styles.inputError,
                ]}
                value={problemText}
                onChangeText={(text) => {
                  setProblemText(text);
                  if (errors.problemText) setErrors((e) => ({ ...e, problemText: undefined }));
                }}
                placeholder="输入题目..."
                multiline
                textAlignVertical="top"
              />
              {errors.problemText && (
                <Text style={styles.errorText}>{errors.problemText}</Text>
              )}
            </View>

            {/* 我的答案 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>我的答案</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  errors.userAnswer && styles.inputError,
                ]}
                value={userAnswer}
                onChangeText={(text) => {
                  setUserAnswer(text);
                  if (errors.userAnswer) setErrors((e) => ({ ...e, userAnswer: undefined }));
                }}
                placeholder="输入你做错的答案..."
                multiline
                textAlignVertical="top"
              />
              {errors.userAnswer && (
                <Text style={styles.errorText}>{errors.userAnswer}</Text>
              )}
            </View>

            {/* 正确答案 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>正确答案</Text>
              <TextInput
                style={[
                  styles.input,
                  styles.multilineInput,
                  errors.correctAnswer && styles.inputError,
                ]}
                value={correctAnswer}
                onChangeText={(text) => {
                  setCorrectAnswer(text);
                  if (errors.correctAnswer) setErrors((e) => ({ ...e, correctAnswer: undefined }));
                }}
                placeholder="输入正确答案..."
                multiline
                textAlignVertical="top"
              />
              {errors.correctAnswer && (
                <Text style={styles.errorText}>{errors.correctAnswer}</Text>
              )}
            </View>

            {/* 解析 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                解析 <Text style={styles.optionalTag}>(可选)</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.multilineInput]}
                value={analysis}
                onChangeText={setAnalysis}
                placeholder="AI 解析或自己的理解..."
                multiline
                textAlignVertical="top"
              />
            </View>

            {/* 标签 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>
                标签 <Text style={styles.optionalTag}>(可选)</Text>
              </Text>
              <TextInput
                style={styles.input}
                value={tagsInput}
                onChangeText={setTagsInput}
                placeholder="多个标签用逗号分隔，如: 代数,方程,易错"
                autoCapitalize="none"
              />
              <Text style={styles.helperText}>
                多个标签请用逗号分隔
              </Text>
            </View>

            {/* 学科 */}
            <View style={styles.formGroup}>
              <Text style={styles.label}>学科</Text>
              <View style={styles.subjectRow}>
                {SUBJECTS.map((sub) => (
                  <TouchableOpacity
                    key={sub}
                    style={[
                      styles.subjectButton,
                      subject === sub && styles.subjectButtonActive,
                    ]}
                    onPress={() => setSubject(sub === subject ? "" : sub)}
                  >
                    <Text
                      style={[
                        styles.subjectButtonText,
                        subject === sub && styles.subjectButtonTextActive,
                      ]}
                    >
                      {sub}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* 已复习 */}
            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>已复习</Text>
                <Switch
                  value={isReviewed}
                  onValueChange={setIsReviewed}
                />
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5ea",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  form: {
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    marginBottom: 8,
  },
  optionalTag: {
    fontSize: 14,
    fontWeight: "400",
    color: "#999",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
    color: "#333",
  },
  multilineInput: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  inputError: {
    borderColor: "#FF3B30",
    backgroundColor: "#fff5f5",
  },
  errorText: {
    fontSize: 13,
    color: "#FF3B30",
    marginTop: 4,
    marginLeft: 2,
  },
  helperText: {
    fontSize: 13,
    color: "#999",
    marginTop: 4,
    marginLeft: 2,
  },
  subjectRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  subjectButton: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: "#ddd",
    backgroundColor: "#f9f9f9",
  },
  subjectButtonActive: {
    borderColor: "#007AFF",
    backgroundColor: "#f0f7ff",
  },
  subjectButtonText: {
    fontSize: 15,
    fontWeight: "500",
    color: "#666",
  },
  subjectButtonTextActive: {
    color: "#007AFF",
    fontWeight: "600",
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  modalFooter: {
    flexDirection: "row",
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e5ea",
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    padding: 16,
    alignItems: "center",
    marginLeft: 12,
    borderRadius: 8,
    backgroundColor: "#007AFF",
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});
