import { useState, useCallback } from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import NotebookList from "@/components/NotebookList";
import NotebookForm from "@/components/NotebookForm";
import type { MistakeRecord } from "@/db/schema";

export default function NotebookPage() {
  const [formVisible, setFormVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<
    MistakeRecord | undefined
  >(undefined);

  const handleOpenAdd = useCallback(() => {
    setEditingRecord(undefined);
    setFormVisible(true);
  }, []);

  const handleEdit = useCallback((record: MistakeRecord) => {
    setEditingRecord(record);
    setFormVisible(true);
  }, []);

  const handleCloseForm = useCallback(() => {
    setFormVisible(false);
    setEditingRecord(undefined);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <NotebookList onEdit={handleEdit} />

      <NotebookForm
        visible={formVisible}
        onClose={handleCloseForm}
        editRecord={editingRecord}
      />

      <TouchableOpacity
        style={styles.fab}
        onPress={handleOpenAdd}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#007AFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
