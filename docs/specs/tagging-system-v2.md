# Tagging System — v2 spec

**Status:** proposed
**Target release:** v1.1.0 (Phase 1) and v1.2.0 (Phase 2)
**Last updated:** 2026-05-17

> This is a planning document, not a commitment. Changes to scope and
> design are expected as the feature gets built. Open a
> [Discussion](https://github.com/schooltwistchris/contact-purge/discussions)
> if you have feedback on the spec itself.

---

## 3-line brief

**Job:** Let users privately tag contacts (Work, BFF, Don't Answer,
etc.) and optionally surface those tags on incoming calls —
local-only, off by default, reversible at every level.

**Object model:** A `Tag` (name + emoji + color + visibility flags)
and a `TagAssignment` linking contact IDs to tag IDs, persisted to
`AsyncStorage` under a single versioned key. Wrapped in a sibling
`TagsContext` to `ContactsContext`.

**Workflow:** User flips a master toggle in Settings → creates their
own tags → assigns them via long-press on contacts. Each tag has its
own opt-in flags for whether it modifies the system caller ID or
silences calls via `sendToVoicemail`.

---

## Data model

```ts
// AsyncStorage key: "contactpurge:tags:v1"
interface TagsState {
  enabled: boolean;            // master switch
  version: 1;                  // for future migrations
  tags: Tag[];
  assignments: Record<string, string[]>;  // contactId → tagIds[]
  // Stash of original names so caller-ID writes are reversible
  nameBackups: Record<string, string>;     // contactId → original name
}

interface Tag {
  id: string;          // uuid
  name: string;        // user input, e.g. "BFF"
  emoji?: string;      // optional, e.g. "💖"
  color: string;       // hex, from preset palette
  showInCallerId: boolean;   // write tag into contact name?
  silenceCalls: boolean;     // flip sendToVoicemail on tagged contacts?
  createdAt: number;
}
```

**Why these choices:**

- **AsyncStorage (not SecureStore)** — tag *names* aren't sensitive
  enough for keychain overhead; the assignments themselves are
  sensitive but local-only anyway.
- **`nameBackups` indexed by contact ID, not by name** — survives
  renames, contact merges, etc.
- **Versioned at the top** so future migrations are clean.
- **Single JSON blob** — for a friends app with ≤500 contacts, this
  is faster and simpler than SQLite.

---

## Phased delivery

| Phase | Ships in | What's in scope |
|---|---|---|
| **1 — Core tagging** | v1.1.0 | Master toggle, create/edit/delete tags, assign via long-press, tag chips on cards, "Tagged" filter. All tag effects stay inside the app. No system-level writes. |
| **2 — System effects** | v1.2.0 | Per-tag "Show in caller ID" (writes tag suffix into contact name with revert). Per-tag "Send to voicemail" (Android-only, flips `sendToVoicemail`). Each is its own opt-in per tag. |

Phase 1 is roughly a weekend of work and is safe. Phase 2 has UX risk
(lockscreen exposure, reverting modified names cleanly) and should
ship only after Phase 1 has lived for a week and collected feedback.

---

## UI changes (Phase 1 only)

### New files

| File | Purpose |
|---|---|
| `context/TagsContext.tsx` | CRUD + persistence + assign/unassign API |
| `components/TagChip.tsx` | Reusable colored pill — used on cards, in pickers, in settings |
| `components/TagPicker.tsx` | Bottom sheet for assigning tags to a contact |
| `components/SettingsSheet.tsx` | Modal with master toggle + "Manage tags →" + "Clear all" |
| `components/TagFilterSheet.tsx` | Sheet listing tags as filter chips with counts |
| `app/tags.tsx` | Manage tags screen — list, create, edit, delete |

### Modifications

| File | Change |
|---|---|
| `app/_layout.tsx` | Wrap tree in `<TagsProvider>` |
| `app/index.tsx` | Gear icon in header (left of "Select All") opens SettingsSheet; long-press flow becomes a bottom sheet with "Tags" + "Delete contact" when tagging enabled (current direct-delete behavior preserved when disabled) |
| `components/ContactCard.tsx` | Render up to 3 tag chips below name (when tagging enabled and contact has tags) |
| `components/FilterBar.tsx` | When tagging enabled, append "Tagged ▾" pill at end of row; tapping it opens TagFilterSheet |
| `package.json` | Re-add `@react-native-async-storage/async-storage` |

---

## Detailed UX flows

### First-time tagging activation

1. User taps gear → Settings sheet opens
2. Toggle "Enable contact tags" — animated to on
3. Inline message: "Tag your contacts to organize them. Long-press a
   contact to add a tag."
4. Optional friendly nudge: "Get started" CTA → opens tag creation
   with 3 prefilled suggestions (BFF, Work, Don't Answer); user can
   accept, edit, or skip

### Creating a tag

Tag editor — single screen:

- **Name** (required, max 20 chars)
- **Emoji** (picker showing 12 common emojis + system picker access)
- **Color** (8-color palette + "random")
- **Show on incoming calls** toggle (Phase 2 only, hidden in Phase 1)
- **Silence calls from tagged contacts** toggle (Phase 2 only,
  Android-only, hidden in Phase 1)
- Bottom: **Save** | **Cancel**

### Assigning tags to a contact

1. Long-press contact card
2. Bottom sheet: **Tags…** | **Delete contact** (destructive red)
3. Tap "Tags…" → opens TagPicker (full-width bottom sheet)
4. Each existing tag rendered as a TagChip with checkbox state
5. Tap a chip to toggle assignment
6. "+ New tag" row at bottom for inline creation
7. Sheet auto-dismisses on backdrop tap; changes persist immediately
   (no Save button)

### Filtering by tag

1. "Tagged ▾" pill in filter bar (only when tagging enabled and at
   least 1 tag exists)
2. Tap → sheet with all tags as filter chips, each with a count of
   tagged contacts
3. Tap a tag chip → filter list to contacts with that tag
4. Filter pill in main bar updates to show selected tag name
5. Tap selected pill to deselect → returns to "All"

### Disabling tagging

1. Settings → toggle off
2. Confirmation alert: "Disable tags? Your tags and assignments stay
   saved — they'll come back if you re-enable."
3. On confirm: hide all tag UI, but data persists in storage
4. (Phase 2 only) Any "Show in caller ID" writes get auto-reverted
   from contact names

### Wiping tag data

Separate "Clear all tags" button in Settings. Destructive confirm:
"Delete all tags and remove them from contacts? This cannot be
undone."

---

## Phase 2 system integration (preview)

### "Show in caller ID" implementation

When toggled on for a tag:

1. App iterates contacts with that tag
2. For each: store `originalName` in `nameBackups`, then call
   `Contacts.updateContactAsync` with new name:
   `` `${originalName} · ${tag.name} ${tag.emoji ?? ''}`.trim() ``
3. Multiple tags on one contact: concatenate, but truncate display to
   first 2 to avoid runaway names like
   `Alex · BFF 💖 · Work 💼 · Owe Money 💸`

When toggled off OR master switch off OR tag deleted:

1. App iterates affected contacts, calls `updateContactAsync` to
   restore from `nameBackups`
2. Clear backup entries

**Known fragility:**

- User renames contact externally while tag is applied → revert may
  put wrong name back. **Mitigation:** on revert, only restore if
  current name still ends with the tag suffix.
- Contact deleted externally → no harm; backup entry becomes orphan,
  cleaned up on next contacts load.

### "Send to voicemail" implementation

Android only. Uses contact's `sendToVoicemail` field via
`Contacts.updateContactAsync`.

- When toggled on for a tag → set `sendToVoicemail: true` on all
  tagged contacts.
- When toggled off → set `sendToVoicemail: false` (assuming this app
  set it — could be smarter and track which contacts the app
  modified).

iOS: hide the toggle entirely.

---

## Open decisions before building

| Decision | Options | Recommendation |
|---|---|---|
| Default master toggle state | Off / On / Ask on first launch | **Off** — least surprise; users opt in deliberately |
| Pre-seed default tags? | Yes / No / Suggest on first activation | **Suggest on first activation** — onboarding helper, not forced data |
| Bring back AsyncStorage dep? | Yes / smaller alternative / `expo-sqlite` | **Yes, AsyncStorage** — standard, well-supported, small |
| One tag per contact or many? | Single / Multiple | **Multiple** — "BFF + Work" makes sense |
| Render tag chips on ContactCard? | Always / Only on detail screen / Configurable | **Always (max 3)** — chips ARE the value of tagging; hiding them defeats the point |
| Filter pill behavior | Single-select / multi-select | **Single-select** (matches existing filter UX) |

---

## Estimated impact

- **Code:** ~1100 lines of new/changed code (Phase 1)
- **APK size:** +~200KB (re-adding AsyncStorage) — negligible
- **Build time:** unchanged (no new native code)
- **Privacy footprint:** unchanged — all data stays in app's local
  AsyncStorage

---

## Privacy considerations

The tags themselves (`Work`, `BFF`, `Don't Answer`) are emotionally
loaded data. Even though they never leave the device, they exist on
the device. Phase 2's "Show in caller ID" feature deliberately makes
some of that data visible on the lockscreen — that's a meaningful
exposure surface that the per-tag opt-in toggle is designed to
mitigate.

Implementation notes:

- Default `showInCallerId` and `silenceCalls` to `false` on every new
  tag, even ones the user creates from the "Get started"
  suggestions.
- Tag-management UI should make it visually obvious which tags have
  these flags enabled (badge or icon on the tag chip).
- "Clear all tags" should also revert any caller ID modifications and
  voicemail flags as part of the cleanup.

---

## Out of scope (won't ship in v1.1 or v1.2)

- Sharing tags between devices (would require a backend)
- Importing tags from a CSV or other app
- Per-tag custom ringtones
- Tag analytics ("you have 47 'Work' contacts")
- Truecaller-style call overlay UI (would require ejecting from
  managed Expo)
