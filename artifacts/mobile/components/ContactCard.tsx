import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import React, { useCallback, useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { ContactItem } from "@/context/ContactsContext";

const AVATAR_COLORS = [
  "#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B",
  "#10B981", "#06B6D4", "#EF4444", "#84CC16",
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatLastContacted(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 1) return "Today";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  const years = Math.floor(diffDays / 365);
  return `${years}yr ago`;
}

interface Props {
  contact: ContactItem;
  selected: boolean;
  onPress: (id: string) => void;
}

export function ContactCard({ contact, selected, onPress }: Props) {
  const colors = useColors();
  const scale = useRef(new Animated.Value(1)).current;
  const avatarColor = getAvatarColor(contact.name);

  const handlePress = useCallback(() => {
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.97,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 80,
        useNativeDriver: true,
      }),
    ]).start();
    onPress(contact.id);
  }, [contact.id, onPress, scale]);

  const primaryPhone = contact.phoneNumbers?.[0]?.number;
  const primaryEmail = !primaryPhone ? contact.emails?.[0]?.email : undefined;
  const subtitle = primaryPhone ?? primaryEmail ?? "No contact info";

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={handlePress}
        style={[
          styles.card,
          {
            backgroundColor: selected
              ? colors.accent
              : colors.card,
            borderColor: selected ? colors.primary : colors.border,
          },
        ]}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${contact.name}, ${selected ? "selected" : "not selected"}`}
      >
        <View
          style={[
            styles.avatar,
            { backgroundColor: selected ? colors.primary : avatarColor },
          ]}
        >
          <Text style={styles.avatarText}>{contact.initials}</Text>
        </View>

        <View style={styles.info}>
          <Text
            style={[styles.name, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {contact.name}
          </Text>
          <Text
            style={[
              styles.subtitle,
              {
                color:
                  subtitle === "No contact info"
                    ? colors.destructive
                    : colors.mutedForeground,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        <View style={styles.meta}>
          {contact.timesContacted != null && (
            <View
              style={[
                styles.badge,
                { backgroundColor: colors.secondary },
              ]}
            >
              <Text style={[styles.badgeText, { color: colors.mutedForeground }]}>
                {contact.timesContacted}x
              </Text>
            </View>
          )}
          {contact.lastTimeContacted != null && (
            <Text
              style={[styles.lastContacted, { color: colors.mutedForeground }]}
            >
              {formatLastContacted(contact.lastTimeContacted)}
            </Text>
          )}
          {!contact.hasStats && (
            <Text style={[styles.noData, { color: colors.mutedForeground }]}>
              No history
            </Text>
          )}
        </View>

        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: selected ? colors.primary : "transparent",
              borderColor: selected ? colors.primary : colors.border,
            },
          ]}
        >
          {selected && (
            <Ionicons name="checkmark" size={14} color="#fff" />
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginVertical: 4,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  info: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  meta: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  lastContacted: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  noData: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
