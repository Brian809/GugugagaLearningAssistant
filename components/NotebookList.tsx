import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useNotebookRecords,
  useNotebookLoading,
  useNotebookStore,
} from "../stores/notebookStore";
import type { MistakeRecord } from "../db/schema";
import MistakeCard from "./MistakeCard";

type FilterType = "all" | "unreviewed" | "reviewed";

const FILTER_OPTIONS: { key: FilterType; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "unreviewed", label: "未复习" },
  { key: "reviewed", label: "已复习" },
];

export default function NotebookList() {
  const records = useNotebookRecords();
  const isLoading = useNotebookLoading();
  const { loadRecords, searchRecords, setFilter, toggleReviewed, deleteRecord } =
    useNotebookStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MistakeRecord[] | null>(
    null,
  );
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [refreshing, setRefreshing] = useState(false);

  const displayRecords = searchResults ?? records;

  const handleSearch = useCallback(async () => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSearchResults(null);
      return;
    }
    const results = await searchRecords(trimmed);
    setSearchResults(results);
  }, [searchQuery, searchRecords]);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  const handleFilterChange = useCallback(
    (filter: FilterType) => {
      setActiveFilter(filter);
      switch (filter) {
        case "all":
          setFilter({ isReviewed: undefined });
          break;
        case "unreviewed":
          setFilter({ isReviewed: false });
          break;
        case "reviewed":
          setFilter({ isReviewed: true });
          break;
      }
    },
    [setFilter],
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRecords();
    setRefreshing(false);
  }, [loadRecords]);

  const handleToggleReview = useCallback(
    async (record: MistakeRecord) => {
      await toggleReviewed(record.id);
    },
    [toggleReviewed],
  );

  const handleDelete = useCallback(
    async (record: MistakeRecord) => {
      await deleteRecord(record.id);
    },
    [deleteRecord],
  );

  const renderItem = useCallback(
    ({ item }: { item: MistakeRecord }) => (
      <MistakeCard
        record={item}
        onToggleReview={handleToggleReview}
        onDelete={handleDelete}
      />
    ),
    [handleToggleReview, handleDelete],
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="document-text-outline" size={64} color="#CCC" />
      <Text style={styles.emptyTitle}>还没有错题记录</Text>
      <Text style={styles.emptySubtitle}>开始解题并保存错题吧！</Text>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.headerContainer}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search"
          size={18}
          color="#999"
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索错题..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <TouchableOpacity onPress={handleClearSearch} style={styles.clearButton}>
            <Ionicons name="close-circle" size={18} color="#999" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Filter Chips */}
      <View style={styles.filterRow}>
        {FILTER_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[
              styles.filterChip,
              activeFilter === option.key && styles.filterChipActive,
            ]}
            onPress={() => handleFilterChange(option.key)}
          >
            <Text
              style={[
                styles.filterChipText,
                activeFilter === option.key && styles.filterChipTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayRecords}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={isLoading ? null : renderEmptyState}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      />
      {isLoading ? (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  listContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
  },
  headerContainer: {
    marginBottom: 12,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  clearButton: {
    padding: 4,
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#f0f0f0",
  },
  filterChipActive: {
    backgroundColor: "#007AFF",
  },
  filterChipText: {
    fontSize: 14,
    color: "#666",
  },
  filterChipTextActive: {
    color: "#fff",
    fontWeight: "500",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    color: "#999",
    marginTop: 16,
    fontWeight: "500",
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#BBB",
    marginTop: 6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.6)",
  },
});
