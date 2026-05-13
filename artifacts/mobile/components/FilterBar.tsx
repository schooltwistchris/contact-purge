import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { useColors } from "@/hooks/useColors";
import type { FreqFilter, TimeFilter } from "@/context/ContactsContext";

const TIME_OPTIONS: { label: string; value: TimeFilter }[] = [
  { label: "Any time", value: "all" },
  { label: "3+ years", value: "3yr" },
  { label: "5+ years", value: "5yr" },
  { label: "10+ years", value: "10yr" },
];

const FREQ_OPTIONS: { label: string; value: FreqFilter }[] = [
  { label: "Any count", value: "all" },
  { label: "Only once", value: "1x" },
  { label: "≤5 times", value: "5x" },
  { label: "≤10 times", value: "10x" },
];

interface FilterChipProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

function FilterChip({ label, active, onPress }: FilterChipProps) {
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
      </Text>
    </TouchableOpacity>
  );
}

interface FilterBarProps {
  timeFilter: TimeFilter;
  freqFilter: FreqFilter;
  onTimeChange: (f: TimeFilter) => void;
  onFreqChange: (f: FreqFilter) => void;
  hasStatsData: boolean;
  totalShowing: number;
  totalContacts: number;
}

export function FilterBar({
  timeFilter,
  freqFilter,
  onTimeChange,
  onFreqChange,
  hasStatsData,
  totalShowing,
  totalContacts,
}: FilterBarProps) {
  const colors = useColors();

  return (
    <View style={[styles.container, { borderBottomColor: colors.border }]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          Last contacted
        </Text>
        {!hasStatsData && (
          <Text style={[styles.noDataHint, { color: colors.mutedForeground }]}>
            Contacts without history qualify for all filters
          </Text>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {TIME_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={timeFilter === opt.value}
            onPress={() => onTimeChange(opt.value)}
          />
        ))}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: colors.mutedForeground, marginTop: 8 }]}>
        Times contacted
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {FREQ_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={freqFilter === opt.value}
            onPress={() => onFreqChange(opt.value)}
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  sectionLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    paddingHorizontal: 16,
    marginBottom: 6,
  },
  noDataHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    maxWidth: 180,
    textAlign: "right",
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
  summary: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    paddingHorizontal: 16,
    paddingTop: 8,
  },
});
