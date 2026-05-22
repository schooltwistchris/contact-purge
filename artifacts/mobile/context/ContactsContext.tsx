import * as Contacts from "expo-contacts";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert, AppState, PermissionsAndroid, Platform } from "react-native";
import CallLogs from "react-native-call-log";

import { getSmsHistory } from "../modules/contact-sms";

export type QualityFilter =
  | "all"
  | "no-info"
  | "service-codes"
  | "duplicates";

export type CallLogStatus =
  | "unavailable" // iOS / web — not supported
  | "unknown" // not yet asked
  | "requesting"
  | "denied"
  | "granted";

// SMS layering sits on top of call-log smart sort. "ineligible" means the
// call-log permission hasn't been granted yet, so SMS can't be offered.
export type SmsLogStatus =
  | "unavailable" // iOS / web — not supported
  | "ineligible" // call log not granted yet (gate)
  | "unknown" // eligible, not yet asked
  | "requesting"
  | "denied"
  | "granted";

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
  qualityFilter: QualityFilter;
  permissionStatus: "unknown" | "granted" | "denied" | "requesting";
  callLogStatus: CallLogStatus;
  smsLogStatus: SmsLogStatus;
  loading: boolean;
  counts: Record<QualityFilter, number>;
  setQualityFilter: (f: QualityFilter) => void;
  toggleSelect: (id: string) => void;
  selectAll: () => void;
  clearSelection: () => void;
  deleteSelected: () => Promise<void>;
  deleteOne: (id: string) => Promise<void>;
  requestPermission: () => Promise<void>;
  enableCallLogSmartSort: () => Promise<void>;
  enableSmsSmartSort: () => Promise<void>;
  reload: () => Promise<void>;
}

const ContactsCtx = createContext<ContactsState | null>(null);

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return "?";
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Service shortcodes: carrier/utility entries auto-added to the address book.
// Examples: "#BAL", "*611", "611", "TMOBILE", "Verizon Wireless".
// Heuristic: name starts with # / * / digit, OR primary phone is a short code
// (≤5 digits after stripping non-digits).
function isServiceShortcode(c: ContactItem): boolean {
  const trimmedName = c.name.trim();
  if (/^[#*]/.test(trimmedName)) return true;
  if (/^\d/.test(trimmedName)) return true;
  const primaryPhone = c.phoneNumbers?.[0]?.number;
  if (primaryPhone) {
    const digits = primaryPhone.replace(/\D/g, "");
    if (digits.length > 0 && digits.length <= 5) return true;
  }
  return false;
}

function hasNoContactInfo(c: ContactItem): boolean {
  const hasPhone = !!c.phoneNumbers?.some(
    (p) => p.number && p.number.trim() !== ""
  );
  const hasEmail = !!c.emails?.some((e) => e.email && e.email.trim() !== "");
  return !hasPhone && !hasEmail;
}

function normalizeNameForDupe(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, " ");
}

function findDuplicateIds(contacts: ContactItem[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const c of contacts) {
    const key = normalizeNameForDupe(c.name);
    if (!key) continue;
    const arr = groups.get(key) ?? [];
    arr.push(c.id);
    groups.set(key, arr);
  }
  const dupes = new Set<string>();
  for (const ids of groups.values()) {
    if (ids.length > 1) {
      ids.forEach((id) => dupes.add(id));
    }
  }
  return dupes;
}

// === Call log aggregation (Android only) ===
// Normalize to last-10-digits so "+1 (555) 012-3456" matches "5550123456"
// and matches against whatever format the call log returns.
function phoneKey(raw: string | undefined | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

type UsageStats = { lastTime: number; count: number };

// Add one interaction (call or text) to a usage map, keyed by phone.
function tallyInteraction(
  m: Map<string, UsageStats>,
  rawNumber: string | undefined | null,
  rawTs: string | number | undefined | null
) {
  const key = phoneKey(rawNumber);
  if (!key) return;
  const ts = typeof rawTs === "string" ? parseInt(rawTs, 10) : Number(rawTs);
  if (!Number.isFinite(ts)) return;
  const existing = m.get(key);
  if (existing) {
    existing.count++;
    if (ts > existing.lastTime) existing.lastTime = ts;
  } else {
    m.set(key, { lastTime: ts, count: 1 });
  }
}

async function loadCallLogUsageMap(): Promise<Map<string, UsageStats>> {
  const logs = await CallLogs.loadAll();
  const m = new Map<string, UsageStats>();
  for (const log of logs) {
    tallyInteraction(m, log.phoneNumber, log.timestamp);
  }
  return m;
}

async function loadSmsUsageMap(): Promise<Map<string, UsageStats>> {
  const messages = await getSmsHistory();
  const m = new Map<string, UsageStats>();
  for (const msg of messages) {
    tallyInteraction(m, msg.address, msg.date);
  }
  return m;
}

// Combine call + SMS usage: take the most recent contact and the total
// interaction count across both channels.
function mergeUsage(
  ...sources: Map<string, UsageStats>[]
): Map<string, UsageStats> {
  const merged = new Map<string, UsageStats>();
  for (const source of sources) {
    for (const [key, stats] of source) {
      const existing = merged.get(key);
      if (existing) {
        existing.count += stats.count;
        if (stats.lastTime > existing.lastTime) {
          existing.lastTime = stats.lastTime;
        }
      } else {
        merged.set(key, { ...stats });
      }
    }
  }
  return merged;
}

function attachUsageStats(
  contacts: ContactItem[],
  usage: Map<string, UsageStats>
): ContactItem[] {
  if (usage.size === 0) return contacts;
  return contacts.map((c) => {
    let bestLast = 0;
    let totalCount = 0;
    let found = false;
    for (const p of c.phoneNumbers ?? []) {
      const key = phoneKey(p.number);
      if (!key) continue;
      const stats = usage.get(key);
      if (stats) {
        found = true;
        totalCount += stats.count;
        if (stats.lastTime > bestLast) bestLast = stats.lastTime;
      }
    }
    if (!found) return c;
    return {
      ...c,
      lastTimeContacted: bestLast,
      timesContacted: totalCount,
      hasStats: true,
    };
  });
}

function getMockContacts(): ContactItem[] {
  const raw: Array<[string, string | undefined, string | undefined]> = [
    ["Alex Park", "+1 555 0144", "alex@example.com"],
    ["Bianca Romero", "+1 555 0188", undefined],
    ["Brent Sawyer", undefined, undefined],
    ["Casey Lin", "+1 555 0199", undefined],
    ["Casey Lin", "+1 555 9999", undefined],
    ["#BAL", "#225", undefined],
    ["#DATA", "#3282", undefined],
    ["#MIN", "#646", undefined],
    ["611", "611", undefined],
    ["Daniela Ortiz", "+1 555 0220", undefined],
    ["Elena Vasquez", undefined, undefined],
    ["Evan Foster", "+1 555 0256", undefined],
    ["George Pemberton", undefined, undefined],
    ["Hana Tanaka", "+1 555 0289", undefined],
    ["Hana Tanaka", undefined, "hana@example.com"],
    ["Ian McAllister", "+1 555 0301", undefined],
    ["Quinn Avery", undefined, undefined],
  ];
  return raw.map(([name, phone, email], i) => ({
    id: `mock-${i}`,
    name,
    initials: getInitials(name),
    phoneNumbers: phone ? [{ number: phone }] : undefined,
    emails: email ? [{ email }] : undefined,
    lastTimeContacted: null,
    timesContacted: null,
    hasStats: false,
  }));
}

export function ContactsProvider({ children }: { children: React.ReactNode }) {
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>("all");
  const [permissionStatus, setPermissionStatus] = useState<
    "unknown" | "granted" | "denied" | "requesting"
  >("unknown");
  const [callLogStatus, setCallLogStatus] = useState<CallLogStatus>(
    Platform.OS === "android" ? "unknown" : "unavailable"
  );
  const [smsLogStatus, setSmsLogStatus] = useState<SmsLogStatus>(
    Platform.OS === "android" ? "ineligible" : "unavailable"
  );
  const [loading, setLoading] = useState(false);

  const duplicateIds = useMemo(() => findDuplicateIds(contacts), [contacts]);

  const counts = useMemo<Record<QualityFilter, number>>(() => {
    let noInfo = 0;
    let service = 0;
    for (const c of contacts) {
      if (hasNoContactInfo(c)) noInfo++;
      if (isServiceShortcode(c)) service++;
    }
    return {
      all: contacts.length,
      "no-info": noInfo,
      "service-codes": service,
      duplicates: duplicateIds.size,
    };
  }, [contacts, duplicateIds]);

  const filteredContacts = useMemo(() => {
    switch (qualityFilter) {
      case "no-info":
        return contacts.filter(hasNoContactInfo);
      case "service-codes":
        return contacts.filter(isServiceShortcode);
      case "duplicates":
        return contacts.filter((c) => duplicateIds.has(c.id));
      case "all":
      default:
        return contacts;
    }
  }, [contacts, qualityFilter, duplicateIds]);

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

      let mapped: ContactItem[] = data
        .filter((c) => c.id && c.name)
        .map((c) => ({
          id: c.id!,
          name: c.name!,
          initials: getInitials(c.name!),
          phoneNumbers: c.phoneNumbers as ContactItem["phoneNumbers"],
          emails: c.emails as ContactItem["emails"],
          imageUri:
            c.imageAvailable && c.image?.uri ? c.image.uri : undefined,
          lastTimeContacted: null,
          timesContacted: null,
          hasStats: false,
        }));

      // Enrich with usage stats from whichever sources the user has granted.
      // Checking OS permissions directly (not React state) keeps this
      // self-contained and always current.
      if (Platform.OS === "android") {
        const maps: Map<string, UsageStats>[] = [];
        try {
          const callLogGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
          );
          if (callLogGranted) maps.push(await loadCallLogUsageMap());
        } catch (e) {
          console.warn("Failed to load call log usage stats:", e);
        }
        try {
          const smsGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_SMS
          );
          if (smsGranted) maps.push(await loadSmsUsageMap());
        } catch (e) {
          console.warn("Failed to load SMS usage stats:", e);
        }
        if (maps.length > 0) {
          mapped = attachUsageStats(mapped, mergeUsage(...maps));
        }
      }

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

  const enableCallLogSmartSort = useCallback(async () => {
    if (Platform.OS !== "android") return;
    setCallLogStatus("requesting");
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_CALL_LOG,
        {
          title: "Use your call history?",
          message:
            "Contact Purge can sort contacts by how recently and how often you've called them. Call history is read locally on your device and never leaves it.",
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        }
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setCallLogStatus("granted");
        // Now eligible to offer SMS layering (if not already decided).
        setSmsLogStatus((prev) =>
          prev === "ineligible" ? "unknown" : prev
        );
        // Re-load contacts now that we can enrich with usage stats.
        await loadContacts();
      } else {
        setCallLogStatus("denied");
      }
    } catch (e) {
      console.warn("Call log permission request failed:", e);
      setCallLogStatus("denied");
    }
  }, [loadContacts]);

  const enableSmsSmartSort = useCallback(async () => {
    if (Platform.OS !== "android") return;
    setSmsLogStatus("requesting");
    try {
      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.READ_SMS,
        {
          title: "Also use your text history?",
          message:
            "Contact Purge can sort more accurately by also counting texts. It reads only phone numbers and timestamps — never the content of your messages. Everything stays on your device.",
          buttonPositive: "Allow",
          buttonNegative: "Not now",
        }
      );
      if (result === PermissionsAndroid.RESULTS.GRANTED) {
        setSmsLogStatus("granted");
        await loadContacts();
      } else {
        setSmsLogStatus("denied");
      }
    } catch (e) {
      console.warn("SMS permission request failed:", e);
      setSmsLogStatus("denied");
    }
  }, [loadContacts]);

  const permissionStatusRef = useRef(permissionStatus);
  useEffect(() => {
    permissionStatusRef.current = permissionStatus;
  }, [permissionStatus]);

  useEffect(() => {
    if (Platform.OS === "web") {
      setPermissionStatus("granted");
      setContacts(getMockContacts());
      return;
    }
    const check = async () => {
      const { status } = await Contacts.getPermissionsAsync();
      if (status === "granted") {
        const wasNotGranted = permissionStatusRef.current !== "granted";
        setPermissionStatus("granted");
        if (wasNotGranted) {
          await loadContacts();
        }
      } else if (status === "denied") {
        setPermissionStatus("denied");
      } else {
        setPermissionStatus("unknown");
      }
      // Sync the call-log UI status with the live OS permission so the
      // "Enable smart sort" button hides automatically if the user grants
      // or revokes it from Settings.
      if (Platform.OS === "android") {
        try {
          const callLogGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
          );
          setCallLogStatus((prev) => {
            if (callLogGranted) return "granted";
            // Don't downgrade "denied" → "unknown" — once denied, keep it
            // so the UI shows the right messaging.
            return prev === "denied" ? "denied" : "unknown";
          });

          // SMS layering is gated behind call log. Mirror the live OS
          // permission, but keep it "ineligible" until call log is granted.
          const smsGranted = await PermissionsAndroid.check(
            PermissionsAndroid.PERMISSIONS.READ_SMS
          );
          setSmsLogStatus((prev) => {
            if (smsGranted) return "granted";
            if (!callLogGranted) return "ineligible";
            return prev === "denied" ? "denied" : "unknown";
          });
        } catch (e) {
          console.warn("Failed to check call log / SMS permission:", e);
        }
      }
    };
    check();
    // Re-check when the user returns to the app (e.g. after toggling
    // permission in Settings). Without this, the "denied" wall sticks
    // even after access has been granted in system Settings.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") check();
    });
    return () => sub.remove();
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
    let errorReason: "permission" | "rejected" | null = null;
    if (Platform.OS !== "web") {
      try {
        await Contacts.removeContactAsync(id);
        // Android's ContentResolver.delete returns no error for read-only or
        // sync-protected contacts (WhatsApp, LinkedIn, Google Workspace, etc).
        // Verify the row is actually gone before claiming success.
        if (Platform.OS === "android") {
          let stillThere;
          try {
            stillThere = await Contacts.getContactByIdAsync(id);
          } catch {
            stillThere = undefined;
          }
          if (stillThere) {
            failed = true;
            errorReason = "rejected";
          }
        }
      } catch (e) {
        console.warn("removeContactAsync failed", e);
        failed = true;
        errorReason = "permission";
      }
    }
    if (failed) {
      Alert.alert(
        "Couldn't delete contact",
        errorReason === "rejected"
          ? "This contact is read-only or synced from an account (Google, Samsung, WhatsApp) that protects it. Open the Contacts app to remove it manually."
          : "Contact Purge couldn't delete this contact. Check Settings → Apps → Contact Purge to make sure Contacts permission is granted."
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
    const deletedIds = new Set<string>();
    let failed = 0;
    if (Platform.OS === "web") {
      ids.forEach((id) => deletedIds.add(id));
    } else {
      for (const id of ids) {
        try {
          await Contacts.removeContactAsync(id);
          if (Platform.OS === "android") {
            let stillThere;
            try {
              stillThere = await Contacts.getContactByIdAsync(id);
            } catch {
              stillThere = undefined;
            }
            if (stillThere) {
              failed++;
              continue;
            }
          }
          deletedIds.add(id);
        } catch (e) {
          console.warn("removeContactAsync failed for", id, e);
          failed++;
        }
      }
    }
    setContacts((prev) => prev.filter((c) => !deletedIds.has(c.id)));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      deletedIds.forEach((id) => next.delete(id));
      return next;
    });
    if (failed > 0) {
      Alert.alert(
        "Some contacts couldn't be deleted",
        `${failed} contact${failed === 1 ? " is" : "s are"} read-only or synced from a protected account (Google, Samsung, WhatsApp). Open the Contacts app to remove ${failed === 1 ? "it" : "them"} manually.`
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
        qualityFilter,
        permissionStatus,
        callLogStatus,
        smsLogStatus,
        loading,
        counts,
        setQualityFilter,
        toggleSelect,
        selectAll,
        clearSelection,
        deleteSelected,
        deleteOne,
        requestPermission,
        enableCallLogSmartSort,
        enableSmsSmartSort,
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
