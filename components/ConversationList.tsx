import React, { useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useConversationStore,
  useConversationList,
  useActiveConversationId,
} from "@/stores/conversationStore";
import { Conversation } from "@/db/schema";

interface ConversationListProps {
  visible: boolean;
  onClose: () => void;
  type: Conversation["type"];
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}

export default function ConversationList({
  visible,
  onClose,
  type,
  onSelect,
  onCreateNew,
}: ConversationListProps) {
  const conversations = useConversationList();
  const activeId = useActiveConversationId();
  const loadConversations = useConversationStore((s) => s.loadConversations);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);

  useEffect(() => {
    if (visible) loadConversations(type);
  }, [visible, type, loadConversations]);

  const handleDelete = (id: string) => {
    Alert.alert("删除对话", "确定要删除这条对话记录吗？", [
      { text: "取消", style: "cancel" },
      {
        text: "删除",
        style: "destructive",
        onPress: () => deleteConversation(id),
      },
    ]);
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity
      style={[
        styles.item,
        item.id === activeId && styles.itemActive,
      ]}
      activeOpacity={0.7}
      onPress={() => {
        onSelect(item.id);
        onClose();
      }}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={styles.itemLeft}>
        <Ionicons
          name={
            item.type === "solve"
              ? "calculator-outline"
              : item.type === "geogebra"
                ? "shapes-outline"
                : "chatbubble-ellipses-outline"
          }
          size={20}
          color={item.id === activeId ? "#007AFF" : "#666"}
        />
        <View style={styles.itemText}>
          <Text style={styles.itemTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={styles.itemDate}>{formatDate(item.updatedAt)}</Text>
        </View>
      </View>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => handleDelete(item.id)}
      >
        <Ionicons name="trash-outline" size={18} color="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>对话历史</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.newButton}
            activeOpacity={0.7}
            onPress={() => {
              onCreateNew();
              onClose();
            }}
          >
            <Ionicons name="add-circle-outline" size={22} color="#007AFF" />
            <Text style={styles.newButtonText}>新建对话</Text>
          </TouchableOpacity>

          {conversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="chatbubbles-outline" size={48} color="#ccc" />
              <Text style={styles.emptyText}>暂无对话记录</Text>
            </View>
          ) : (
            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              style={styles.list}
            />
          )}
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
    minHeight: "40%",
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
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    gap: 8,
  },
  newButtonText: {
    fontSize: 16,
    color: "#007AFF",
    fontWeight: "500",
  },
  list: {
    flex: 1,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  itemActive: {
    backgroundColor: "#f0f7ff",
  },
  itemLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  itemText: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: "500",
    color: "#333",
  },
  itemDate: {
    fontSize: 12,
    color: "#999",
    marginTop: 2,
  },
  deleteBtn: {
    padding: 8,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 12,
  },
});
