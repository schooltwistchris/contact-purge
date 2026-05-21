import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TagChip } from "@/components/TagChip";
import { TagManager } from "@/components/TagManager";
import { useTags } from "@/context/TagsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  contactId: string | null;
  contactName?: string;
  onClose: () => void;
}

export function TagPicker({ visible, contactId, contactName, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { tags, assignments, toggleAssignment } = useTags();
  const [managerOpen, setManagerOpen] = useState(false);

  const assigned = contactId ? assignments[contactId] ?? [] : [];

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable
        style={[styles.overlay, { backgroundColor: colors.overlay }]}
        onPress={onClose}
      >
        <Pressable
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + 16,
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ width: 24 }} />
            <Text
              style={[styles.title, { color: colors.foreground }]}
              numberOfLines={1}
            >
              {contactName ? `Tag ${contactName}` : "Tags"}
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            {tags.length === 0 ? (
              <Text style={[styles.empty, { color: colors.mutedForeground }]}>
                No tags yet. Create your first one below.
              </Text>
            ) : (
              tags.map((tag) => {
                const isOn = assigned.includes(tag.id);
                return (
                  <Pressable
                    key={tag.id}
                    onPress={() =>
                      contactId && toggleAssignment(contactId, tag.id)
                    }
                    style={[
                      styles.row,
                      {
                        backgroundColor: colors.card,
                        borderColor: isOn ? tag.color : colors.border,
                      },
                    ]}
                  >
                    <TagChip tag={tag} size="md" />
                    <View
                      style={[
                        styles.check,
                        {
                          backgroundColor: isOn ? tag.color : "transparent",
                          borderColor: isOn ? tag.color : colors.border,
                        },
                      ]}
                    >
                      {isOn && (
                        <Ionicons name="checkmark" size={14} color="#fff" />
                      )}
                    </View>
                  </Pressable>
                );
              })
            )}

            <Pressable
              onPress={() => setManagerOpen(true)}
              style={[styles.newBtn, { borderColor: colors.primary }]}
            >
              <Ionicons name="add" size={20} color={colors.primary} />
              <Text style={[styles.newBtnText, { color: colors.primary }]}>
                New tag
              </Text>
            </Pressable>
          </ScrollView>
        </Pressable>
      </Pressable>

      <TagManager visible={managerOpen} onClose={() => setManagerOpen(false)} />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  sheet: {
    maxHeight: "80%",
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
  title: { fontSize: 17, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  content: { padding: 16, gap: 10 },
  empty: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    paddingVertical: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  newBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
