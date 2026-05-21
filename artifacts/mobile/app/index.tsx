import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useMemo, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  FlatList,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ContactCard } from "@/components/ContactCard";
import { FilterBar } from "@/components/FilterBar";
import { SettingsModal } from "@/components/SettingsModal";
import { TagPicker } from "@/components/TagPicker";
import { useContacts } from "@/context/ContactsContext";
import { useTags } from "@/context/TagsContext";
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
          onPress={() => Linking.openSettings()}
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

const EMPTY_COPY: Record<string, { title: string; subtitle: string }> = {
  all: {
    title: "No contacts",
    subtitle: "Your contact list is already clean.",
  },
  "no-info": {
    title: "Nothing here",
    subtitle:
      "Every contact has at least a phone number or email — no orphans to clean up.",
  },
  "service-codes": {
    title: "No service codes",
    subtitle:
      "No carrier shortcodes or short numbers found in your contacts.",
  },
  duplicates: {
    title: "No duplicates",
    subtitle: "No contacts share the same name.",
  },
};

function EmptyState({ qualityFilter }: { qualityFilter: string }) {
  const colors = useColors();
  const copy = EMPTY_COPY[qualityFilter] ?? EMPTY_COPY.all;
  return (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle" size={56} color={colors.primary} />
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
        {copy.title}
      </Text>
      <Text style={[styles.emptySubtitle, { color: colors.mutedForeground }]}>
        {copy.subtitle}
      </Text>
    </View>
  );
}

function SmartSortBanner() {
  const colors = useColors();
  const { callLogStatus, enableCallLogSmartSort } = useContacts();

  // Hide on iOS/web (unavailable), once granted, or while the system prompt
  // is open. "denied" still shows the button so the user can re-try.
  if (callLogStatus === "unavailable" || callLogStatus === "granted") {
    return null;
  }
  const isDenied = callLogStatus === "denied";
  const isRequesting = callLogStatus === "requesting";
  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: colors.secondary, borderColor: colors.border },
      ]}
    >
      <Ionicons name="sparkles" size={18} color={colors.primary} />
      <View style={styles.bannerText}>
        <Text style={[styles.bannerTitle, { color: colors.foreground }]}>
          {isDenied ? "Smart sort is off" : "Sort by call history?"}
        </Text>
        <Text
          style={[styles.bannerSubtitle, { color: colors.mutedForeground }]}
          numberOfLines={2}
        >
          {isDenied
            ? "Grant call history access in Settings to surface contacts you haven't called recently."
            : "Read locally on your device. Never leaves your phone."}
        </Text>
      </View>
      <Pressable
        onPress={
          isDenied ? () => Linking.openSettings() : enableCallLogSmartSort
        }
        disabled={isRequesting}
        style={[styles.bannerBtn, { backgroundColor: colors.primary }]}
      >
        {isRequesting ? (
          <ActivityIndicator size="small" color={colors.primaryForeground} />
        ) : (
          <Text
            style={[styles.bannerBtnText, { color: colors.primaryForeground }]}
          >
            {isDenied ? "Settings" : "Enable"}
          </Text>
        )}
      </Pressable>
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
    qualityFilter,
    permissionStatus,
    loading,
    counts,
    setQualityFilter,
    toggleSelect,
    selectAll,
    clearSelection,
    deleteSelected,
    deleteOne,
    reload,
  } = useContacts();

  const {
    enabled: tagsEnabled,
    tags,
    assignments,
    getTagsForContact,
    countForTag,
  } = useTags();

  const [deleting, setDeleting] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pickerContactId, setPickerContactId] = useState<string | null>(null);
  const [activeTagId, setActiveTagId] = useState<string | null>(null);

  // Final list = quality-filtered (from context) then tag-filtered (local).
  const displayedContacts = useMemo(() => {
    if (!tagsEnabled || !activeTagId) return filteredContacts;
    return filteredContacts.filter((c) =>
      (assignments[c.id] ?? []).includes(activeTagId)
    );
  }, [filteredContacts, tagsEnabled, activeTagId, assignments]);

  const pickerContact = pickerContactId
    ? contacts.find((c) => c.id === pickerContactId)
    : undefined;

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

  const confirmDeleteOne = useCallback(
    (id: string, name: string) => {
      Alert.alert(
        `Delete ${name}?`,
        "This cannot be undone. Contacts synced from Google or Samsung accounts may not be fully removed here.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              if (Platform.OS !== "web") {
                Haptics.notificationAsync(
                  Haptics.NotificationFeedbackType.Warning
                );
              }
              await deleteOne(id);
            },
          },
        ]
      );
    },
    [deleteOne]
  );

  const handleLongPressContact = useCallback(
    (id: string) => {
      const contact = contacts.find((c) => c.id === id);
      if (!contact) return;
      // With tagging on, long-press opens an action menu. Otherwise it
      // jumps straight to the delete confirmation (original behavior).
      if (tagsEnabled) {
        Alert.alert(contact.name, undefined, [
          { text: "Tags…", onPress: () => setPickerContactId(id) },
          {
            text: "Delete",
            style: "destructive",
            onPress: () => confirmDeleteOne(id, contact.name),
          },
          { text: "Cancel", style: "cancel" },
        ]);
      } else {
        confirmDeleteOne(id, contact.name);
      }
    },
    [contacts, tagsEnabled, confirmDeleteOne]
  );

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
              Contact Purge
            </Text>
            <Text
              style={[styles.headerSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
              {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
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
              <>
                <Pressable
                  onPress={() => setSettingsOpen(true)}
                  style={[
                    styles.iconBtn,
                    { backgroundColor: colors.secondary },
                  ]}
                  accessibilityLabel="Settings"
                >
                  <Ionicons
                    name="settings-outline"
                    size={20}
                    color={colors.foreground}
                  />
                </Pressable>
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
              </>
            )}
          </View>
        </View>
      </View>

      {/* Filter Bar */}
      <FilterBar
        qualityFilter={qualityFilter}
        onChange={setQualityFilter}
        counts={counts}
        totalShowing={filteredContacts.length}
        totalContacts={contacts.length}
      />

      <SmartSortBanner />

      {/* Tag filter row — only when tagging is on and tags exist */}
      {tagsEnabled && tags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagFilterRow}
          style={[styles.tagFilterWrap, { borderBottomColor: colors.border }]}
        >
          <Pressable
            onPress={() => setActiveTagId(null)}
            style={[
              styles.tagFilterChip,
              {
                backgroundColor:
                  activeTagId === null ? colors.primary : colors.secondary,
                borderColor:
                  activeTagId === null ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.tagFilterChipText,
                {
                  color:
                    activeTagId === null
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                },
              ]}
            >
              All
            </Text>
          </Pressable>
          {tags.map((tag) => {
            const active = activeTagId === tag.id;
            return (
              <Pressable
                key={tag.id}
                onPress={() => setActiveTagId(active ? null : tag.id)}
                style={[
                  styles.tagFilterChip,
                  {
                    backgroundColor: active ? tag.color : colors.secondary,
                    borderColor: active ? tag.color : colors.border,
                  },
                ]}
              >
                {tag.emoji ? (
                  <Text style={styles.tagFilterEmoji}>{tag.emoji}</Text>
                ) : (
                  <View
                    style={[styles.tagFilterDot, { backgroundColor: tag.color }]}
                  />
                )}
                <Text
                  style={[
                    styles.tagFilterChipText,
                    { color: active ? "#fff" : colors.foreground },
                  ]}
                >
                  {tag.name}
                </Text>
                <Text
                  style={[
                    styles.tagFilterCount,
                    {
                      color: active
                        ? "rgba(255,255,255,0.8)"
                        : colors.mutedForeground,
                    },
                  ]}
                >
                  {countForTag(tag.id)}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {/* Contact List */}
      <FlatList
        data={displayedContacts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ContactCard
            contact={item}
            selected={selectedIds.has(item.id)}
            onPress={toggleSelect}
            onLongPress={handleLongPressContact}
            tags={tagsEnabled ? getTagsForContact(item.id) : undefined}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <EmptyState qualityFilter={qualityFilter} />
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
        scrollEnabled={displayedContacts.length > 0}
      />

      <SettingsModal
        visible={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
      <TagPicker
        visible={pickerContactId !== null}
        contactId={pickerContactId}
        contactName={pickerContact?.name}
        onClose={() => setPickerContactId(null)}
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
    alignItems: "center",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  tagFilterWrap: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    maxHeight: 52,
  },
  tagFilterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  tagFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  tagFilterChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  tagFilterEmoji: { fontSize: 13 },
  tagFilterDot: { width: 7, height: 7, borderRadius: 4 },
  tagFilterCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
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
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  bannerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  bannerSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 14,
  },
  bannerBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 64,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
});
