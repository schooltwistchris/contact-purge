import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContactCard } from "@/components/ContactCard";
import { FilterBar } from "@/components/FilterBar";
import { useContacts } from "@/context/ContactsContext";
import { useColors } from "@/hooks/useColors";

function PermissionScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { requestPermission, permissionStatus } = useContacts();

  const isWeb = Platform.OS === "web";

  return (
    <View
      style={[
        styles.centerContainer,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top + (Platform.OS === "web" ? 67 : 0),
          paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0),
        },
      ]}
    >
      <View
        style={[styles.iconCircle, { backgroundColor: colors.secondary }]}
      >
        <Ionicons name="people" size={48} color={colors.primary} />
      </View>
      <Text style={[styles.permTitle, { color: colors.foreground }]}>
        {isWeb ? "Open on your Samsung" : "Access Contacts"}
      </Text>
      <Text style={[styles.permSubtitle, { color: colors.mutedForeground }]}>
        {isWeb
          ? "This app works on your Samsung Galaxy device via the Expo Go app. Scan the QR code from the URL bar to get started."
          : permissionStatus === "denied"
          ? "Contacts access was denied. Please enable it in Settings to use this app."
          : "Allow access to your contacts to find and remove ones you no longer need."}
      </Text>
      {!isWeb && permissionStatus !== "denied" && (
        <Pressable
          onPress={requestPermission}
          style={[styles.permButton, { backgroundColor: colors.primary }]}
        >
          <Text style={[styles.permButtonText, { color: colors.primaryForeground }]}>
            Allow Contacts Access
          </Text>
        </Pressable>
      )}
      {!isWeb && permissionStatus === "denied" && (
        <Pressable
          onPress={() =>
            Alert.alert(
              "Open Settings",
              "Go to Settings > Contact Cleaner > Contacts and enable access."
            )
          }
          style={[styles.permButton, { backgroundColor: colors.secondary }]}
        >
          <Text style={[styles.permButtonText, { color: colors.foreground }]}>
            Open Settings
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function EmptyState({
  timeFilter,
  freqFilter,
}: {
  timeFilter: string;
  freqFilter: string;
}) {
  const colors = useColors();
  const isFiltered = timeFilter !== "all" || freqFilter !== "all";
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {isFiltered ? "No matches" : "No contacts"}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {isFiltered
          ? "Try adjusting your filters to find more contacts."
          : "Your contact list is already clean."}
      </Text>
    </View>
  );
}

export default function MainScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    filteredContacts,
    contacts,
    selectedIds,
    timeFilter,
    freqFilter,
    permissionStatus,
    loading,
    hasStatsData,
    setTimeFilter,
    setFreqFilter,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
    reload,
  } = useContacts();

  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    const count = selectedIds.size;
    Alert.alert(
      `Delete ${count} Contact${count !== 1 ? "s" : ""}?`,
      "This cannot be undone. Contacts synced from Google or Samsung accounts may not be fully removed here.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (Platform.OS !== "web") {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            }
            setDeleting(true);
            await deleteSelected();
            setDeleting(false);
          },
        },
      ]
    );
  }, [selectedIds.size, deleteSelected]);

  const isSelecting = selectedIds.size > 0;
  const allSelected =
    filteredContacts.length > 0 &&
    filteredContacts.every((c) => selectedIds.has(c.id));

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 0);

  if (permissionStatus === "requesting") {
    return (
      <View
        style={[styles.centerContainer, { backgroundColor: colors.background }]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (permissionStatus !== "granted") {
    return <PermissionScreen />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text
              style={[styles.headerTitle, { color: colors.foreground }]}
              numberOfLines={1}
            >
              Clean Contacts
            </Text>
            <Text
              style={[styles.headerSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              Samsung Galaxy
            </Text>
          </View>
          <View style={styles.headerActions}>
            {isSelecting ? (
              <>
                <Pressable
                  onPress={allSelected ? clearSelection : selectAll}
                  style={[
                    styles.headerBtn,
                    { backgroundColor: colors.secondary },
                  ]}
                >
                  <Text
                    style={[styles.headerBtnText, { color: colors.foreground }]}
                  >
                    {allSelected ? "None" : "All"}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleDelete}
                  disabled={deleting}
                  style={[
                    styles.headerBtn,
                    { backgroundColor: colors.destructive },
                  ]}
                >
                  {deleting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={[styles.headerBtnText, { color: "#fff" }]}>
                      Delete {selectedIds.size}
                    </Text>
                  )}
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={selectAll}
                style={[
                  styles.headerBtn,
                  { backgroundColor: colors.secondary },
                ]}
              >
                <Text
                  style={[styles.headerBtnText, { color: colors.foreground }]}
                >
                  Select All
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <FilterBar
        timeFilter={timeFilter}
        freqFilter={freqFilter}
        onTimeChange={setTimeFilter}
        onFreqChange={setFreqFilter}
        hasStatsData={hasStatsData}
        totalShowing={filteredContacts.length}
        totalContacts={contacts.length}
      />

      {/* Contact List */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            selected={selectedIds.has(item.id)}
            onPress={toggleSelect}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState timeFilter={timeFilter} freqFilter={freqFilter} />
          )
        }
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={reload}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: bottomPad + 16 },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={filteredContacts.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  headerLeft: {
    gap: 1,
    flexShrink: 1,
    flexGrow: 0,
    minWidth: 0,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.2,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  headerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  listContent: {
    paddingTop: 8,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  permTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
    letterSpacing: -0.3,
  },
  permSubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
  permButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    marginTop: 8,
  },
  permButtonText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 22,
  },
});
