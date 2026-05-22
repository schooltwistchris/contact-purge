package expo.modules.contactsms

import android.provider.Telephony
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ContactSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ContactSms")

    // Reads the SMS log and returns one entry per message: the other
    // party's address (phone number) and the message timestamp in ms.
    //
    // PRIVACY: the projection deliberately requests ONLY the ADDRESS and
    // DATE columns. The message BODY is never queried, read, or returned.
    // Do not add Telephony.Sms.BODY to the projection — see
    // docs/specs/sms-history-opt-in.md.
    AsyncFunction("getSmsHistory") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()

      val projection = arrayOf(
        Telephony.Sms.ADDRESS,
        Telephony.Sms.DATE
      )

      val results = mutableListOf<Map<String, Any>>()
      context.contentResolver.query(
        Telephony.Sms.CONTENT_URI,
        projection,
        null,
        null,
        null
      )?.use { cursor ->
        val addressIdx = cursor.getColumnIndex(Telephony.Sms.ADDRESS)
        val dateIdx = cursor.getColumnIndex(Telephony.Sms.DATE)
        if (addressIdx < 0 || dateIdx < 0) return@use
        while (cursor.moveToNext()) {
          val address = cursor.getString(addressIdx) ?: continue
          val date = cursor.getLong(dateIdx)
          results.add(mapOf("address" to address, "date" to date))
        }
      }

      return@AsyncFunction results
    }
  }
}
