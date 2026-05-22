import { requireNativeModule } from "expo-modules-core";

export type SmsRecord = {
  /** The other party's phone number as stored in the SMS log. */
  address: string;
  /** Message timestamp, ms since epoch. */
  date: number;
};

// Native module is Android-only. requireNativeModule throws if missing,
// so callers must guard with Platform.OS === "android".
const ContactSms = requireNativeModule("ContactSms");

/**
 * Reads the device SMS log. Returns only phone numbers + timestamps —
 * message content is never read (see the Kotlin module + the SMS spec).
 * Requires READ_SMS permission to have been granted.
 */
export async function getSmsHistory(): Promise<SmsRecord[]> {
  return await ContactSms.getSmsHistory();
}
