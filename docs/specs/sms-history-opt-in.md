# SMS-history opt-in — spec

**Status:** proposed
**Target release:** v1.3.0 (after tagging system ships in v1.1.0 / v1.2.0)
**Last updated:** 2026-05-19

> Planning document, not a commitment. Open a
> [Discussion](https://github.com/schooltwistchris/contact-purge/discussions)
> for spec feedback.

---

## 3-line brief

**Job:** Let users layer SMS thread metadata on top of the existing
call-log smart sort, for a more accurate "haven't been in touch"
signal — most people text more than they call, and a phone-call-only
view incorrectly flags texting-only relationships as low contact.

**Object model:** Add a third permission state (`smsLogStatus`)
parallel to `callLogStatus`; extend the usage aggregator to read SMS
thread metadata via a new native package; merge with call-log data
by normalized phone number, taking `max(lastTime)` and
`sum(count)`.

**Workflow:** User opts into call-log smart sort first → after grant,
a secondary banner offers SMS layering → user opts in → READ_SMS
prompt → app re-aggregates with combined data → contact cards reflect
the fuller picture. SMS can be revoked independently of call log.

---

## Why this is a separate, second opt-in

`READ_SMS` is the most sensitive runtime permission Android exposes.
SMS often carries:

- 2FA codes (banking, email, ride-share)
- Password resets
- Personal/intimate messages
- Healthcare appointment reminders
- Delivery notifications with addresses

Even friends who trusted you enough to install a sideloaded APK and
grant call log will reasonably pause at this one. So:

1. **It is not bundled with call-log smart sort** — users get the call
   layer first, see it work, then choose whether to layer SMS on top
2. **The disclosure has to be specific:** the app reads SMS *metadata*
   (sender/recipient phone numbers, timestamps, direction), never
   message *content*
3. **It is revocable independently** of call log

---

## What the app would actually read from SMS

| Field | Used? | Why |
|---|---|---|
| Sender / recipient phone number | ✅ | Phone-number-keyed aggregation, same as call log |
| Timestamp | ✅ | `lastTime` calculation |
| Direction (sent / received) | ✅ | Count both directions toward `count` |
| Thread ID | ✅ | Avoid double-counting group MMS |
| Message body / content | ❌ | **Never read.** Privacy red line. |
| Attachments / MMS media | ❌ | Same. |
| Read / unread state | ❌ | Not relevant to "have we been in touch" |

The privacy policy and in-app disclosure must explicitly state the
"never read" lines and back them by code that demonstrably doesn't
access those fields.

---

## Data model changes

```ts
// New permission state, parallel to callLogStatus
type SmsLogStatus =
  | "unavailable" // iOS / web — not supported
  | "ineligible"  // call log not yet granted (gate)
  | "unknown"     // not yet asked
  | "requesting"
  | "denied"
  | "granted";

// Existing UsageStats stays the same — just sourced from both call + SMS
type UsageStats = { lastTime: number; count: number };

// Internal: separate maps for each source, merged at attach time
interface UsageSources {
  callLog: Map<string, UsageStats>;
  smsLog: Map<string, UsageStats>;
}

function mergeUsage(sources: UsageSources): Map<string, UsageStats> {
  const merged = new Map<string, UsageStats>();
  for (const [key, callStats] of sources.callLog) {
    merged.set(key, { ...callStats });
  }
  for (const [key, smsStats] of sources.smsLog) {
    const existing = merged.get(key);
    if (existing) {
      merged.set(key, {
        lastTime: Math.max(existing.lastTime, smsStats.lastTime),
        count: existing.count + smsStats.count,
      });
    } else {
      merged.set(key, { ...smsStats });
    }
  }
  return merged;
}
```

**Why separate maps before merging:** if user revokes one of the two
permissions, we want to re-aggregate cheaply by dropping that source
without losing the other. Also makes it easy to add per-source
attribution in the UI later (e.g., a tooltip: "Last contact: text 2
weeks ago").

---

## UX flow

### Stage 0 — pre-conditions
User must have call-log smart sort enabled. SMS opt-in is hidden
otherwise. The banner shows `ineligible` state copy if somehow
reached without call log.

### Stage 1 — secondary banner

After call-log permission is granted and the first re-load completes,
a second banner appears below the (now-hidden) call-log banner:

```
✨ Also use text history? More accurate.
   Reads only phone numbers and timestamps — never message content.
                                              [ Enable ]   [ Skip ]
```

- "Skip" dismisses for the current session (re-appears next launch
  unless user explicitly dismisses via Settings — see "open
  decisions")
- "Enable" → READ_SMS permission prompt

### Stage 2 — permission prompt

System prompt with rationale text:

> *Contact Purge needs to read your text history to sort contacts by
> recency more accurately. We read only the phone numbers and
> timestamps of your messages — never the content. All data stays on
> your device.*

### Stage 3 — granted

- Re-aggregate contacts with merged call + SMS data
- Re-render the list
- Banner disappears
- Contact cards now reflect fuller picture
- (Optional) Brief toast: "Smart sort now includes texts ✓"

### Stage 4 — denied

- Banner switches to: "SMS history is off. Grant access in Settings."
  with a Settings deep-link, same pattern as call-log denial
- Smart sort continues to work with call-log data only

### Stage 5 — revocation

Independent revocation paths:

- Revoke call log only → SMS layer also disappears (no call log =
  feature gate fails)
- Revoke SMS only → call log smart sort keeps working
- Revoke both → entire smart sort feature falls back to manual mode

---

## Package selection

Need an Android-only RN package that reads SMS via `READ_SMS`. Options
as of writing:

| Package | Last updated | New-arch compatible? | Notes |
|---|---|---|---|
| `react-native-get-sms-android` | Active in 2026 | Likely | Most well-known; broad API |
| `react-native-sms-retriever` | Last 2023 | Unknown | For OTP-style flows, not general read |
| Custom native module | n/a | Yes if we write it | Maximum control, more maintenance |

**Recommendation:** `react-native-get-sms-android` if the version
shipping at v1.3.0 time supports new architecture. If not, write a
minimal custom Expo module — we only need `listConversations()` /
`getSmsList()` style queries, not the full API surface.

---

## Implementation outline

```ts
// In context/ContactsContext.tsx, extending the existing loadUsageMap()

async function loadCombinedUsageMap(): Promise<Map<string, UsageStats>> {
  const sources: UsageSources = {
    callLog: new Map(),
    smsLog: new Map(),
  };

  if (await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_CALL_LOG
  )) {
    sources.callLog = await loadCallLogUsageMap();
  }

  if (await PermissionsAndroid.check(
    PermissionsAndroid.PERMISSIONS.READ_SMS
  )) {
    sources.smsLog = await loadSmsUsageMap();
  }

  return mergeUsage(sources);
}

async function loadSmsUsageMap(): Promise<Map<string, UsageStats>> {
  const messages = await SmsAndroid.list({
    // Don't request 'body' field — keep our access surface minimal
    indexFrom: 0,
    maxCount: -1, // all messages
  });
  const m = new Map<string, UsageStats>();
  for (const msg of messages) {
    const key = phoneKey(msg.address);
    if (!key) continue;
    const ts = Number(msg.date);
    if (!Number.isFinite(ts)) continue;
    const existing = m.get(key);
    if (existing) {
      existing.count++;
      if (ts > existing.lastTime) existing.lastTime = ts;
    } else {
      m.set(key, { lastTime: ts, count: 1 });
    }
  }
  return m;
}
```

**Critical implementation note:** the SMS read code must
explicitly NOT request or store the `body` field. This should be
visible in the source so privacy-conscious users can verify by
reading the code. Add a code comment that's literally
`// Body field intentionally never requested — see SMS spec`.

---

## Privacy considerations

### Disclosures required

**In-app, before the permission prompt:** the disclosure shown in the
banner is the *prominent disclosure*. Make it specific:

> "Reads only phone numbers and timestamps — never message content."

**Privacy policy update:** add a section to the existing Gist
explicitly mentioning SMS metadata access, what's read, what isn't,
and the same "stays on device" guarantee.

**README + landing page:** mention the optional SMS layer when
describing the smart-sort feature. Don't bury it.

### What changes for the user's threat model

- App now technically has access to all SMS content via the granted
  permission, even though we don't read it
- A bug or future feature that *did* read content would inherit this
  access without a new prompt
- Mitigation: linter / code-review rule that flags any access to
  message body fields; periodic audit

### Why this is still net-positive privacy-wise

The alternative (more accurate smart sort) is for users to manually
maintain a "people I actually talk to" list, which they won't do.
With this opt-in, the sort works correctly and *no data ever leaves
the device*. The trust ask is "trust we don't read the body" — backed
by open-source code.

---

## Open decisions

| Decision | Options | Recommendation |
|---|---|---|
| When does the secondary banner appear? | Immediately after call-log grant / on next launch / wait N days | **Immediately after call-log grant** — strike while interest is hot, but only once |
| Persistence of "Skip" | One-session / persistent until manual re-enable | **Persistent** — once skipped, only re-appears via explicit Settings toggle |
| Show SMS as separate "smart sort tier" or fully merged into existing? | Tiered / merged | **Merged** — simpler UX, the data point is "have we been in touch" regardless of channel |
| Per-source attribution in card UI | Show "via texts" or "via calls" / unified display | **Unified** for v1.3.0; add per-source if users ask |
| Handle MMS group threads | Include / exclude | **Exclude initially** — group MMS skews counts (one message ≠ one one-on-one interaction) |

---

## Estimated impact

- **Code:** ~150 lines of new code (loader, merge logic, UI banner,
  settings toggle)
- **APK size:** +~250 KB for the SMS native package
- **Build time:** unchanged
- **Privacy footprint:** materially larger because READ_SMS is the
  most sensitive permission — mitigated by strict opt-in and minimal
  data access

---

## Out of scope (won't ship in v1.3.0)

- Reading message content for any purpose
- iMessage / iOS — there is no equivalent API on iOS even if we
  shipped iOS support
- Merging messaging from third-party apps (WhatsApp, Signal,
  Telegram) — they don't expose this and shouldn't
- Custom rules ("only count outgoing texts" etc.) — start simple
- Group MMS deduplication beyond exclusion (could add later if users
  want)

---

## Cross-references

- [Tagging system v2 spec](./tagging-system-v2.md) — the related
  feature that should ship first
- Privacy policy:
  [Gist](https://gist.github.com/schooltwistchris/2e79e2cbfe9dbc84f162ffc6dbf1565e)
  — must be updated when this ships
