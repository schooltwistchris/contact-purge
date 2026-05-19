import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { QualityFilter } from "@/context/ContactsContext";

const OPTIONS: { label: string; value: QualityFilter }[] = [
  { label: "All", value: "all" },
  { label: "No phone or email", value: "no-info" },
  { label: "Service codes", value: "service-codes" },
  { label: "Duplicates", value: "duplicates" },
];

interface FilterChipProps {
  label: string;
  count: number;
  active: boolean;
  onPress: () => void;
}

function FilterChip({ label, count, active, onPress }: FilterChipProps) {
  const colors = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? colors.primary : colors.secondary,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? colors.primaryForeground : colors.mutedForeground },
        ]}
      >
        {label}
        <Text style={styles.chipCount}> {count}</Text>
      </Text>
    </TouchableOpacity>
  );
}

interface FilterBarProps {
  qualityFilter: QualityFilter;
  onChange: (f: QualityFilter) => void;
  counts: Record<QualityFilter, number>;
  totalShowing: number;
  totalContacts: number;
}

export function FilterBar({
  qualityFilter,
  onChange,
  counts,
  totalShowing,
  totalContacts,
}: FilterBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            count={counts[opt.value]}
            active={qualityFilter === opt.value}
            onPress={() => onChange(opt.value)}
          />
        ))}
      </ScrollView>

      <Text style={[styles.summary, { color: colors.mutedForeground }]}>
        Showing {totalShowing} of {totalContacts} contacts
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  chipCount: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    opacity: 0.7,
  },
  summary: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
