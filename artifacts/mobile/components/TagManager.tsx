import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TagChip } from "@/components/TagChip";
import {
  TAG_COLORS,
  TAG_EMOJI_SUGGESTIONS,
  useTags,
  type Tag,
} from "@/context/TagsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

type Editing =
  | { mode: "list" }
  | { mode: "create" }
  | { mode: "edit"; tag: Tag };

export function TagManager({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tags, createTag, updateTag, deleteTag, countForTag } = useTags();

  const [editing, setEditing] = useState<Editing>({ mode: "list" });

  // editor fields
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState<string | undefined>(undefined);
  const [color, setColor] = useState<string>(TAG_COLORS[0]);

  const openCreate = () => {
    setName("");
    setEmoji(undefined);
    setColor(TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)]);
    setEditing({ mode: "create" });
  };

  const openEdit = (tag: Tag) => {
    setName(tag.name);
    setEmoji(tag.emoji);
    setColor(tag.color);
    setEditing({ mode: "edit", tag });
  };

  const save = () => {
    const trimmed = name.trim();
    if (!trimmed) {
      Alert.alert("Name required", "Give the tag a short name.");
      return;
    }
    if (editing.mode === "edit") {
      updateTag(editing.tag.id, { name: trimmed, emoji, color });
    } else {
      createTag({ name: trimmed, emoji, color });
    }
    setEditing({ mode: "list" });
  };

  const confirmDelete = (tag: Tag) => {
    const n = countForTag(tag.id);
    Alert.alert(
      `Delete "${tag.name}"?`,
      n > 0
        ? `This tag is on ${n} contact${n === 1 ? "" : "s"}. Deleting it removes it from ${n === 1 ? "that contact" : "them"} (the contacts themselves are untouched).`
        : "This tag isn't on any contacts yet.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTag(tag.id);
            setEditing({ mode: "list" });
          },
        },
      ]
    );
  };

  const isEditor = editing.mode === "create" || editing.mode === "edit";
  const previewTag: Tag = {
    id: "preview",
    name: name.trim() || "Tag name",
    emoji,
    color,
    showInCallerId: false,
    silenceCalls: false,
    createdAt: 0,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (isEditor) setEditing({ mode: "list" });
        else onClose();
      }}
    >
      <View style={[styles.overlay, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
        >
          {/* Header */}
          <View
            style={[styles.header, { borderBottomColor: colors.border }]}
          >
            {isEditor ? (
              <Pressable
                onPress={() => setEditing({ mode: "list" })}
                hitSlop={10}
              >
                <Ionicons name="chevron-back" size={24} color={colors.foreground} />
              </Pressable>
            ) : (
              <View style={{ width: 24 }} />
            )}
            <Text style={[styles.title, { color: colors.foreground }]}>
              {editing.mode === "create"
                ? "New tag"
                : editing.mode === "edit"
                ? "Edit tag"
                : "Manage tags"}
            </Text>
            <Pressable
              onPress={() => {
                if (isEditor) setEditing({ mode: "list" });
                else onClose();
              }}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          {!isEditor ? (
            <ScrollView contentContainerStyle={styles.listContent}>
              {tags.length === 0 ? (
                <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                  No tags yet. Create one to start organizing your contacts.
                </Text>
              ) : (
                tags.map((tag) => (
                  <Pressable
                    key={tag.id}
                    onPress={() => openEdit(tag)}
                    style={[
                      styles.row,
                      { backgroundColor: colors.card, borderColor: colors.border },
                    ]}
                  >
                    <TagChip tag={tag} size="md" />
                    <View style={styles.rowRight}>
                      <Text
                        style={[styles.count, { color: colors.mutedForeground }]}
                      >
                        {countForTag(tag.id)}
                      </Text>
                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color={colors.mutedForeground}
                      />
                    </View>
                  </Pressable>
                ))
              )}

              <Pressable
                onPress={openCreate}
                style={[styles.newBtn, { borderColor: colors.primary }]}
              >
                <Ionicons name="add" size={20} color={colors.primary} />
                <Text style={[styles.newBtnText, { color: colors.primary }]}>
                  New tag
                </Text>
              </Pressable>
            </ScrollView>
          ) : (
            <ScrollView contentContainerStyle={styles.editorContent}>
              {/* Preview */}
              <View style={styles.previewRow}>
                <TagChip tag={previewTag} size="md" />
              </View>

              {/* Name */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                NAME
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Work, BFF, Don't answer"
                placeholderTextColor={colors.mutedForeground}
                maxLength={20}
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                    color: colors.foreground,
                  },
                ]}
              />

              {/* Emoji */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                EMOJI (OPTIONAL)
              </Text>
              <View style={styles.emojiGrid}>
                <Pressable
                  onPress={() => setEmoji(undefined)}
                  style={[
                    styles.emojiCell,
                    {
                      backgroundColor: colors.card,
                      borderColor:
                        emoji === undefined ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                    None
                  </Text>
                </Pressable>
                {TAG_EMOJI_SUGGESTIONS.map((e) => (
                  <Pressable
                    key={e}
                    onPress={() => setEmoji(e)}
                    style={[
                      styles.emojiCell,
                      {
                        backgroundColor: colors.card,
                        borderColor: emoji === e ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={{ fontSize: 20 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>

              {/* Color */}
              <Text style={[styles.label, { color: colors.mutedForeground }]}>
                COLOR
              </Text>
              <View style={styles.colorRow}>
                {TAG_COLORS.map((c) => (
                  <Pressable
                    key={c}
                    onPress={() => setColor(c)}
                    style={[
                      styles.colorCell,
                      {
                        backgroundColor: c,
                        borderColor:
                          color === c ? colors.foreground : "transparent",
                      },
                    ]}
                  >
                    {color === c && (
                      <Ionicons name="checkmark" size={18} color="#fff" />
                    )}
                  </Pressable>
                ))}
              </View>

              {/* Actions */}
              <Pressable
                onPress={save}
                style={[styles.saveBtn, { backgroundColor: colors.primary }]}
              >
                <Text
                  style={[styles.saveBtnText, { color: colors.primaryForeground }]}
                >
                  {editing.mode === "edit" ? "Save changes" : "Create tag"}
                </Text>
              </Pressable>

              {editing.mode === "edit" && (
                <Pressable
                  onPress={() => confirmDelete(editing.tag)}
                  style={styles.deleteBtn}
                >
                  <Text style={[styles.deleteBtnText, { color: colors.destructive }]}>
                    Delete tag
                  </Text>
                </Pressable>
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  listContent: { padding: 16, gap: 10 },
  empty: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 24,
    lineHeight: 20,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  count: { fontSize: 13, fontFamily: "Inter_500Medium" },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    marginTop: 4,
  },
  newBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  editorContent: { padding: 16, gap: 8 },
  previewRow: { alignItems: "center", paddingVertical: 12 },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
  },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  emojiCell: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  colorCell: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtn: {
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  deleteBtn: { marginTop: 12, paddingVertical: 12, alignItems: "center" },
  deleteBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
