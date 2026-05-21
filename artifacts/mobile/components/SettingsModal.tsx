import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import React, { useState } from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TagManager } from "@/components/TagManager";
import { useTags } from "@/context/TagsContext";
import { useColors } from "@/hooks/useColors";

interface Props {
  visible: boolean;
  onClose: () => void;
}

const REPO_URL = "https://github.com/schooltwistchris/contact-purge";

export function SettingsModal({ visible, onClose }: Props) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { enabled, setEnabled, tags, clearAll } = useTags();

  const [managerOpen, setManagerOpen] = useState(false);

  const appVersion =
    Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? "—";

  const handleToggle = (on: boolean) => {
    if (!on) {
      Alert.alert(
        "Disable tags?",
        "Your tags and assignments stay saved — they'll come back if you re-enable.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Disable", onPress: () => setEnabled(false) },
        ]
      );
    } else {
      setEnabled(true);
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      "Clear all tags?",
      "Deletes every tag and removes them from all contacts. Your contacts themselves are not touched. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Clear all", style: "destructive", onPress: clearAll },
      ]
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
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
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <View style={{ width: 24 }} />
            <Text style={[styles.title, { color: colors.foreground }]}>
              Settings
            </Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </Pressable>
          </View>

          <View style={styles.body}>
            {/* Tags section */}
            <Text style={[styles.section, { color: colors.mutedForeground }]}>
              CONTACT TAGS
            </Text>

            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                    Enable contact tags
                  </Text>
                  <Text
                    style={[styles.rowSub, { color: colors.mutedForeground }]}
                  >
                    Label contacts (Work, BFF, etc.) and filter by them.
                  </Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={handleToggle}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor="#fff"
                />
              </View>

              {enabled && (
                <>
                  <View
                    style={[styles.divider, { backgroundColor: colors.border }]}
                  />
                  <Pressable
                    onPress={() => setManagerOpen(true)}
                    style={styles.rowBetween}
                  >
                    <View style={styles.rowText}>
                      <Text
                        style={[styles.rowTitle, { color: colors.foreground }]}
                      >
                        Manage tags
                      </Text>
                      <Text
                        style={[styles.rowSub, { color: colors.mutedForeground }]}
                      >
                        {tags.length} tag{tags.length === 1 ? "" : "s"}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.mutedForeground}
                    />
                  </Pressable>
                </>
              )}
            </View>

            {enabled && tags.length > 0 && (
              <Pressable onPress={handleClearAll} style={styles.clearBtn}>
                <Text style={[styles.clearBtnText, { color: colors.destructive }]}>
                  Clear all tags
                </Text>
              </Pressable>
            )}

            {/* About */}
            <Text
              style={[
                styles.section,
                { color: colors.mutedForeground, marginTop: 24 },
              ]}
            >
              ABOUT
            </Text>
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.rowBetween}>
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                  Version
                </Text>
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  {appVersion}
                </Text>
              </View>
              <View
                style={[styles.divider, { backgroundColor: colors.border }]}
              />
              <Pressable
                onPress={() => Linking.openURL(REPO_URL)}
                style={styles.rowBetween}
              >
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>
                  Source &amp; feedback
                </Text>
                <Ionicons
                  name="open-outline"
                  size={18}
                  color={colors.mutedForeground}
                />
              </Pressable>
            </View>
          </View>
        </View>
      </View>

      <TagManager visible={managerOpen} onClose={() => setManagerOpen(false)} />
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
  body: { padding: 16 },
  section: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    gap: 12,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontFamily: "Inter_500Medium" },
  rowSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  divider: { height: StyleSheet.hairlineWidth },
  clearBtn: { paddingVertical: 14, alignItems: "center" },
  clearBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
});
