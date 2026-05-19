# Contact Purge

A small Android app for finding and removing contacts you haven't been in
touch with. Runs entirely on your phone — nothing leaves your device.

> Built for friends and family. Currently sideload-only; not on Play
> Store. If you trust me enough to install an APK, you're in the right
> place.

## What it does

- **Find low-value contacts fast** — filter your address book by:
  - **No phone or email** — orphan entries you'll never use
  - **Service codes** — carrier-added shortcuts like `#BAL`, `*611`
  - **Duplicates** — entries that share a name
- **Smart sort (optional)** — opt in to call-history access and the app
  sorts contacts by how recently and how often you've actually called
  them. Useful for the "haven't talked to in years" cleanup.
- **Long-press to delete** — confirm individually, or bulk-select with
  taps and delete in one go.
- **Honest about failures** — Android silently rejects deletes for
  contacts synced from accounts like WhatsApp, Google Workspace, or
  Samsung. The app verifies each deletion and tells you when one
  didn't actually go through, instead of pretending it worked.

## Install

1. Grab the latest `.apk` from
   [Releases](https://github.com/schooltwistchris/contact-purge/releases/latest).
2. On your Android phone, open the file. You'll see a warning about
   installing from an unknown source — that's standard for any app not
   distributed through the Play Store. Tap "Settings" and toggle
   "Allow from this source" for your browser/file manager.
3. Tap install. The app appears in your app drawer as **Contact Purge**.
4. First launch: grant Contacts permission. Smart sort (call log) is a
   separate, optional opt-in shown as a banner inside the app.

> **Updates** ship as new APKs in Releases. Click **Watch → Custom →
> Releases** at the top of this page to get notified when a new
> version drops.

## Privacy

The app reads your contacts (and, if you opt in, your call log) only
on-device, only to power the filtering and sorting. Nothing is
transmitted anywhere. No analytics, no crash reporting, no third-party
SDKs.

Full privacy policy:
[gist.github.com/schooltwistchris/2e79e2cbfe9dbc84f162ffc6dbf1565e](https://gist.github.com/schooltwistchris/2e79e2cbfe9dbc84f162ffc6dbf1565e)

## Feedback

- Bug or weird behavior →
  [open an Issue](https://github.com/schooltwistchris/contact-purge/issues/new/choose)
- Idea, question, or just "this is nice" →
  [start a Discussion](https://github.com/schooltwistchris/contact-purge/discussions)
- ⭐ If the app saved you time, give it a star — it helps friends-of-friends
  trust the link when you share it.

## Tech

Expo SDK 54 · React Native 0.81 · New Architecture · React Compiler ·
expo-router · expo-contacts · react-native-call-log.

Source is in `artifacts/mobile/`. Builds run on
[EAS Build](https://docs.expo.dev/build/introduction/); each tagged
release has its APK attached.

## Limitations

- **Android only.** iOS doesn't expose the same metadata Android does
  for the smart-sort feature, and there's no plan to ship an iOS
  version right now.
- **Some contacts can't be deleted from inside the app.** WhatsApp,
  Telegram, LinkedIn, Google Workspace contacts — these are
  read-only from the OS's perspective. The app will tell you when
  this happens and you can delete them from your phone's built-in
  Contacts app.
- **Account sync can resurrect deletions.** If a contact was synced
  from Google or Samsung and your sync is paused, "deleting" it
  locally may not propagate. Turn sync on, delete, sync — or delete
  from Google Contacts / Samsung directly.

## License

MIT. See [LICENSE](LICENSE).
