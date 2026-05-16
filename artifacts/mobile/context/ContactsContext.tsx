import * as Contacts from "expo-contacts";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Alert, Platform } from "react-native";

export type TimeFilter = "all" | "3yr" | "5yr" | "10yr";
export type FreqFilter = "all" | "1x" | "5x" | "10x";

export interface ContactItem {
  id: string;
  name: string;
  initials: string;
  phoneNumbers?: Array<{ number?: string; label?: string }>;
  emails?: Array<{ email?: string }>;
  imageUri?: string;
  lastTimeContacted?: number | null;
  timesContacted?: number | null;
  hasStats: boolean;
}

interface ContactsState {
  contacts: ContactItem[];
  filteredContacts: ContactItem[];
  selectedIds: Set<string>;
  timeFilter: TimeFilter;
  freqFilter: FreqFilter;
  permissionStatus: "unknown" | "granted" | "denied" | "requesting";
  loading: boolean;
  hasStatsData: boolean;
  setTimeFilter: (f: TimeFilter) => void;
  setFreqFilter: (f: FreqFilter) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  requestPermission: () => Promise<void>;
  reload: () => Promise<void>;
}

const ContactsCtx = createContext<ContactsState | null>(null);

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_YEAR = 365.25 * MS_DAY;

function getMockContacts(): ContactItem[] {
  const now = Date.now();
  const raw: Array<[string, string | undefined, number | null, number | null]> = [
    ["Aaron Mitchell", "+1 555 0123", now - 12 * MS_YEAR, 1],
    ["Alex Park", "+1 555 0144", now - 30 * MS_DAY, 47],
    ["Bianca Romero", "+1 555 0188", now - 6 * MS_YEAR, 2],
    ["Brent Sawyer", undefined, null, null],
    ["Casey Lin", "+1 555 0199", now - 3 * MS_DAY, 312],
    ["Chen Wei", "+1 555 0211", now - 8 * MS_YEAR, 1],
    ["Daniela Ortiz", "+1 555 0220", now - 2 * MS_YEAR, 23],
    ["Derek Holmes", "+1 555 0234", now - 11 * MS_YEAR, 3],
    ["Elena Vasquez", "+1 555 0245", now - 4 * MS_YEAR, 5],
    ["Evan Foster", "+1 555 0256", now - 1 * MS_YEAR, 89],
    ["Fatima Khan", "+1 555 0267", now - 5.5 * MS_YEAR, 4],
    ["George Pemberton", undefined, null, null],
    ["Hana Tanaka", "+1 555 0289", now - 90 * MS_DAY, 156],
    ["Ian McAllister", "+1 555 0301", now - 7 * MS_YEAR, 1],
    ["Jade Robinson", "+1 555 0312", now - 4.2 * MS_YEAR, 8],
    ["Kai Bennett", "+1 555 0323", now - 14 * MS_YEAR, 2],
    ["Leo Marchetti", "+1 555 0334", now - 200 * MS_DAY, 67],
    ["Maya Singh", "+1 555 0345", now - 3.5 * MS_YEAR, 9],
    ["Nina Kowalski", "+1 555 0356", now - 6.8 * MS_YEAR, 1],
    ["Oscar Delgado", "+1 555 0367", now - 11 * MS_DAY, 234],
    ["Priya Reddy", "+1 555 0378", now - 5 * MS_YEAR, 6],
    ["Quinn Avery", undefined, null, null],
    ["Rafael Costa", "+1 555 0390", now - 9 * MS_YEAR, 2],
    ["Sasha Petrov", "+1 555 0401", now - 60 * MS_DAY, 45],
    ["Tomás Núñez", "+1 555 0412", now - 13 * MS_YEAR, 1],
    ["Uma Patel", "+1 555 0423", now - 3.1 * MS_YEAR, 4],
    ["Victor Hwang", "+1 555 0434", now - 7.5 * MS_YEAR, 3],
    ["Wendy Brooks", "+1 555 0445", now - 5 * MS_DAY, 178],
    ["Xavier Dunn", "+1 555 0456", now - 10 * MS_YEAR, 1],
    ["Yuki Sato", "+1 555 0467", now - 4 * MS_YEAR, 7],
    ["Zara Khalil", "+1 555 0478", now - 6 * MS_YEAR, 2],
  ];
  return raw.map(([name, phone, lastTime, times], i) => ({
    id: `mock-${i}`,
    name,
    initials: getInitials(name),
    phoneNumbers: phone ? [{ number: phone }] : undefined,
    lastTimeContacted: lastTime,
    timesContacted: times,
    hasStats: lastTime !== null || times !== null,
  }));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getYearCutoff(filter: TimeFilter): number | null {
  const now = Date.now();
  const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
  if (filter === "3yr") return now - 3 * MS_PER_YEAR;
  if (filter === "5yr") return now - 5 * MS_PER_YEAR;
  if (filter === "10yr") return now - 10 * MS_PER_YEAR;
  return null;
}

function getFreqMax(filter: FreqFilter): number | null {
  if (filter === "1x") return 1;
  if (filter === "5x") return 5;
  if (filter === "10x") return 10;
  return null;
}

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("all");
  const [freqFilter, setFreqFilter] = useState<FreqFilter>("all");
  const [permissionStatus, setPermissionStatus] = useState<
    "unknown" | "granted" | "denied" | "requesting"
  >("unknown");
  const [loading, setLoading] = useState(false);

  const hasStatsData = useMemo(
    () => contacts.some((c) => c.hasStats),
    [contacts]
  );

  const filteredContacts = useMemo(() => {
    const cutoff = getYearCutoff(timeFilter);
    const maxFreq = getFreqMax(freqFilter);

    return contacts.filter((c) => {
      let passesTime = true;
      if (cutoff !== null) {
        if (c.lastTimeContacted != null) {
          passesTime = c.lastTimeContacted < cutoff;
        }
        // contacts with no data = treated as never contacted → always pass time filter
      }

      let passesFreq = true;
      if (maxFreq !== null) {
        if (c.timesContacted != null) {
          passesFreq = c.timesContacted <= maxFreq;
        }
        // contacts with no data = treated as 0 → always pass freq filter
      }

      return passesTime && passesFreq;
    });
  }, [contacts, timeFilter, freqFilter]);

  const loadContacts = useCallback(async () => {
    if (Platform.OS === "web") {
      setContacts(getMockContacts());
      return;
    }
    setLoading(true);
    try {
      const { data } = await Contacts.getContactsAsync({
        fields: [
          Contacts.Fields.Name,
          Contacts.Fields.PhoneNumbers,
          Contacts.Fields.Emails,
          Contacts.Fields.Image,
          Contacts.Fields.ImageAvailable,
        ],
        sort: Contacts.SortTypes.LastName,
      });

      const mapped: ContactItem[] = data
        .filter((c) => c.id && c.name)
        .map((c) => {
          const raw = c as unknown as Record<string, unknown>;
          const lastTime =
            typeof raw["lastTimeContacted"] === "number"
              ? (raw["lastTimeContacted"] as number)
              : null;
          const times =
            typeof raw["timesContacted"] === "number"
              ? (raw["timesContacted"] as number)
              : null;

          return {
            id: c.id!,
            name: c.name!,
            initials: getInitials(c.name!),
            phoneNumbers: c.phoneNumbers as ContactItem["phoneNumbers"],
            emails: c.emails as ContactItem["emails"],
            imageUri:
              c.imageAvailable && c.image?.uri ? c.image.uri : undefined,
            lastTimeContacted: lastTime,
            timesContacted: times,
            hasStats: lastTime !== null || times !== null,
          };
        });

      setContacts(mapped);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (Platform.OS === "web") return;
    setPermissionStatus("requesting");
    const { status, canAskAgain } =
      await Contacts.requestPermissionsAsync();
    if (status === "granted") {
      setPermissionStatus("granted");
      await loadContacts();
    } else if (!canAskAgain) {
      setPermissionStatus("denied");
    } else {
      setPermissionStatus("denied");
    }
  }, [loadContacts]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setPermissionStatus("granted");
      setContacts(getMockContacts());
      return;
    }
    (async () => {
      const { status } = await Contacts.getPermissionsAsync();
      if (status === "granted") {
        setPermissionStatus("granted");
        await loadContacts();
      } else if (status === "denied") {
        setPermissionStatus("denied");
      } else {
        setPermissionStatus("unknown");
      }
    })();
  }, [loadContacts]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredContacts.map((c) => c.id)));
  }, [filteredContacts]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const deleteOne = useCallback(async (id: string) => {
    let failed = false;
    if (Platform.OS !== "web") {
      try {
        await Contacts.removeContactAsync(id);
      } catch {
        failed = true;
      }
    }
    if (failed) {
      Alert.alert(
        "Couldn't delete contact",
        "This contact (likely synced from Google/Samsung) couldn't be removed. Open the Contacts app to delete it manually."
      );
      return;
    }
    setContacts((prev) => prev.filter((c) => c.id !== id));
    setSelectedIds((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  const deleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    let failed = 0;
    if (Platform.OS !== "web") {
      for (const id of ids) {
        try {
          await Contacts.removeContactAsync(id);
        } catch {
          failed++;
        }
      }
    }
    setContacts((prev) => prev.filter((c) => !selectedIds.has(c.id)));
    setSelectedIds(new Set());
    if (failed > 0) {
      Alert.alert(
        "Some contacts couldn't be deleted",
        `${failed} contact(s) (likely synced from Google/Samsung) couldn't be removed. Open Contacts app to delete them manually.`
      );
    }
  }, [selectedIds]);

  const reload = useCallback(async () => {
    await loadContacts();
  }, [loadContacts]);

  return (
    <ContactsCtx.Provider
      value={{
        contacts,
        filteredContacts,
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
        deleteOne,
        requestPermission,
        reload,
      }}
    >
      {children}
    </ContactsCtx.Provider>
  );
}

export function useContacts(): ContactsState {
  const ctx = useContext(ContactsCtx);
  if (!ctx) throw new Error("useContacts must be used inside ContactsProvider");
  return ctx;
}
