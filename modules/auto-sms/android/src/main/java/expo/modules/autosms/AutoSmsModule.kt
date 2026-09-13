package expo.modules.autosms

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class AutoSmsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AutoSms")

    AsyncFunction("sendSms") { phoneNumber: String, message: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("NO_CONTEXT", "React context yok", null)
        return@AsyncFunction
      }

      val permission = ContextCompat.checkSelfPermission(context, Manifest.permission.SEND_SMS)
      if (permission != PackageManager.PERMISSION_GRANTED) {
        promise.reject("NO_PERMISSION", "SEND_SMS izni yok", null)
        return@AsyncFunction
      }

      val cleaned = phoneNumber.filter { it.isDigit() || it == '+' }
      if (cleaned.filter { it.isDigit() }.length < 7) {
        promise.reject("BAD_PHONE", "Geçersiz telefon numarası", null)
        return@AsyncFunction
      }

      if (message.isBlank()) {
        promise.reject("BAD_MESSAGE", "Mesaj boş", null)
        return@AsyncFunction
      }

      try {
        val smsManager = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          context.getSystemService(SmsManager::class.java)
            ?: SmsManager.getDefault()
        } else {
          @Suppress("DEPRECATION")
          SmsManager.getDefault()
        }

        val parts = smsManager.divideMessage(message)
        if (parts != null && parts.size > 1) {
          smsManager.sendMultipartTextMessage(cleaned, null, parts, null, null)
        } else {
          smsManager.sendTextMessage(cleaned, null, message, null, null)
        }

        promise.resolve(
          mapOf(
            "ok" to true,
            "phone" to cleaned,
            "parts" to (parts?.size ?: 1)
          )
        )
      } catch (e: SecurityException) {
        promise.reject("SECURITY", e.message, e)
      } catch (e: Exception) {
        promise.reject("SEND_FAILED", e.message, e)
      }
    }

    Function("isAvailable") {
      true
    }
  }
}
