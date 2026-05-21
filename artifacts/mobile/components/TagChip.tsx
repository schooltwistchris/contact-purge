import React from "react";
import { StyleSheet, Text, View } from "react-native";

import type { Tag } from "@/context/TagsContext";

interface Props {
  tag: Tag;
  size?: "sm" | "md";
}

/**
 * A small colored pill representing a tag. The background is a translucent
 * wash of the tag color; the text and a leading dot use the full color so
 * it stays legible on both light and dark backgrounds.
 */
export function TagChip({ tag, size = "sm" }: Props) {
  const isMd = size === "md";
  return (
    <View
      style={[
        styles.chip,
        isMd ? styles.chipMd : styles.chipSm,
        { backgroundColor: tag.color + "22", borderColor: tag.color + "55" },
      ]}
    >
      {tag.emoji ? (
        <Text style={isMd ? styles.emojiMd : styles.emojiSm}>{tag.emoji}</Text>
      ) : (
        <View
          style={[
            styles.dot,
            isMd ? styles.dotMd : styles.dotSm,
            { backgroundColor: tag.color },
          ]}
        />
      )}
      <Text
        numberOfLines={1}
        style={[
          isMd ? styles.textMd : styles.textSm,
          { color: tag.color },
        ]}
      >
        {tag.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: "flex-start",
  },
  chipSm: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 4,
    maxWidth: 130,
  },
  chipMd: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 16,
    gap: 6,
    maxWidth: 220,
  },
  emojiSm: { fontSize: 11 },
  emojiMd: { fontSize: 15 },
  dot: { borderRadius: 999 },
  dotSm: { width: 6, height: 6 },
  dotMd: { width: 8, height: 8 },
  textSm: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  textMd: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
