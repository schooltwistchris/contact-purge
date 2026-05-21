import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const STORAGE_KEY = "contactpurge:tags:v1";

export const TAG_COLORS = [
  "#3B82F6", // blue
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#F59E0B", // amber
  "#10B981", // emerald
  "#06B6D4", // cyan
  "#EF4444", // red
  "#84CC16", // lime
] as const;

export const TAG_EMOJI_SUGGESTIONS = [
  "⭐", "💖", "💼", "🚫", "🔥", "👯", "📞", "🏠",
  "💰", "🎉", "❤️", "😴", "🤝", "👻", "🍕", "🎯",
];

export interface Tag {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  // Phase 2 fields (declared now so persisted data is forward-compatible;
  // unused in v1.1.0).
  showInCallerId: boolean;
  silenceCalls: boolean;
  createdAt: number;
}

interface PersistedState {
  version: 1;
  enabled: boolean;
  tags: Tag[];
  assignments: Record<string, string[]>; // contactId -> tagIds[]
}

interface TagsState {
  enabled: boolean;
  loaded: boolean;
  tags: Tag[];
  assignments: Record<string, string[]>;
  setEnabled: (on: boolean) => void;
  createTag: (input: {
    name: string;
    emoji?: string;
    color: string;
  }) => void;
  updateTag: (
    id: string,
    patch: Partial<Pick<Tag, "name" | "emoji" | "color">>
  ) => void;
  deleteTag: (id: string) => void;
  toggleAssignment: (contactId: string, tagId: string) => void;
  getTagsForContact: (contactId: string) => Tag[];
  countForTag: (tagId: string) => number;
  clearAll: () => void;
}

const TagsCtx = createContext<TagsState | null>(null);

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

const EMPTY: PersistedState = {
  version: 1,
  enabled: false,
  tags: [],
  assignments: {},
};

export function TagsProvider({ children }: { children: React.ReactNode }) {
  const [enabled, setEnabledState] = useState(false);
  const [tags, setTags] = useState<Tag[]>([]);
  const [assignments, setAssignments] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);

  // Hydrate from storage once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && raw) {
          const parsed = JSON.parse(raw) as PersistedState;
          if (parsed && parsed.version === 1) {
            setEnabledState(!!parsed.enabled);
            setTags(Array.isArray(parsed.tags) ? parsed.tags : []);
            setAssignments(
              parsed.assignments && typeof parsed.assignments === "object"
                ? parsed.assignments
                : {}
            );
          }
        }
      } catch (e) {
        console.warn("Failed to load tags from storage:", e);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist on any change, but only after the initial hydrate so we don't
  // clobber stored data with empty defaults on first render.
  const persist = useCallback(
    (next: Partial<PersistedState>) => {
      const snapshot: PersistedState = {
        version: 1,
        enabled: next.enabled ?? enabled,
        tags: next.tags ?? tags,
        assignments: next.assignments ?? assignments,
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot)).catch((e) =>
        console.warn("Failed to persist tags:", e)
      );
    },
    [enabled, tags, assignments]
  );

  const setEnabled = useCallback(
    (on: boolean) => {
      setEnabledState(on);
      persist({ enabled: on });
    },
    [persist]
  );

  const createTag = useCallback(
    (input: { name: string; emoji?: string; color: string }) => {
      setTags((prev) => {
        const tag: Tag = {
          id: genId(),
          name: input.name.trim().slice(0, 20),
          emoji: input.emoji,
          color: input.color,
          showInCallerId: false,
          silenceCalls: false,
          createdAt: Date.now(),
        };
        const next = [...prev, tag];
        persist({ tags: next });
        return next;
      });
    },
    [persist]
  );

  const updateTag = useCallback(
    (id: string, patch: Partial<Pick<Tag, "name" | "emoji" | "color">>) => {
      setTags((prev) => {
        const next = prev.map((t) =>
          t.id === id
            ? {
                ...t,
                ...patch,
                name:
                  patch.name !== undefined
                    ? patch.name.trim().slice(0, 20)
                    : t.name,
              }
            : t
        );
        persist({ tags: next });
        return next;
      });
    },
    [persist]
  );

  const deleteTag = useCallback(
    (id: string) => {
      setTags((prevTags) => {
        const nextTags = prevTags.filter((t) => t.id !== id);
        setAssignments((prevAssign) => {
          const nextAssign: Record<string, string[]> = {};
          for (const [contactId, tagIds] of Object.entries(prevAssign)) {
            const filtered = tagIds.filter((tid) => tid !== id);
            if (filtered.length > 0) nextAssign[contactId] = filtered;
          }
          persist({ tags: nextTags, assignments: nextAssign });
          return nextAssign;
        });
        return nextTags;
      });
    },
    [persist]
  );

  const toggleAssignment = useCallback(
    (contactId: string, tagId: string) => {
      setAssignments((prev) => {
        const current = prev[contactId] ?? [];
        const has = current.includes(tagId);
        const nextForContact = has
          ? current.filter((t) => t !== tagId)
          : [...current, tagId];
        const next = { ...prev };
        if (nextForContact.length > 0) next[contactId] = nextForContact;
        else delete next[contactId];
        persist({ assignments: next });
        return next;
      });
    },
    [persist]
  );

  // Stable lookups backed by refs so the callbacks don't change identity
  // every render (keeps memoized consumers from thrashing).
  const tagsRef = useRef(tags);
  const assignmentsRef = useRef(assignments);
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    assignmentsRef.current = assignments;
  }, [assignments]);

  const getTagsForContact = useCallback((contactId: string): Tag[] => {
    const ids = assignmentsRef.current[contactId];
    if (!ids || ids.length === 0) return [];
    return tagsRef.current.filter((t) => ids.includes(t.id));
  }, []);

  const countForTag = useCallback((tagId: string): number => {
    let n = 0;
    for (const ids of Object.values(assignmentsRef.current)) {
      if (ids.includes(tagId)) n++;
    }
    return n;
  }, []);

  const clearAll = useCallback(() => {
    setTags([]);
    setAssignments({});
    persist({ tags: [], assignments: {} });
  }, [persist]);

  const value = useMemo<TagsState>(
    () => ({
      enabled,
      loaded,
      tags,
      assignments,
      setEnabled,
      createTag,
      updateTag,
      deleteTag,
      toggleAssignment,
      getTagsForContact,
      countForTag,
      clearAll,
    }),
    [
      enabled,
      loaded,
      tags,
      assignments,
      setEnabled,
      createTag,
      updateTag,
      deleteTag,
      toggleAssignment,
      getTagsForContact,
      countForTag,
      clearAll,
    ]
  );

  return <TagsCtx.Provider value={value}>{children}</TagsCtx.Provider>;
}

export function useTags(): TagsState {
  const ctx = useContext(TagsCtx);
  if (!ctx) throw new Error("useTags must be used inside TagsProvider");
  return ctx;
}
