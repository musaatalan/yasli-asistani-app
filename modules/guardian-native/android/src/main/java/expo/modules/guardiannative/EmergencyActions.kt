package expo.modules.guardiannative

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.telephony.SmsManager
import androidx.core.content.ContextCompat

object EmergencyActions {
  fun fire(ctx: Context, reason: String) {
    val phones = GuardianPrefs.phones(ctx)
    val primary = GuardianPrefs.primaryPhone(ctx).ifBlank {
      phones.firstOrNull().orEmpty()
    }
    val body = buildString {
      append(reason)
      append(" — Güvenli Yaşlı Asistanı\n")
      append(GuardianPrefs.message(ctx))
      append("\nZaman: ")
      append(java.text.SimpleDateFormat("dd.MM.yyyy HH:mm:ss", java.util.Locale("tr", "TR"))
        .format(java.util.Date()))
    }

    for (phone in phones.distinct()) {
      sendSms(ctx, phone, body)
    }

    if (primary.isNotBlank()) {
      dial(ctx, primary)
    }

    // Uygulamayı öne getir
    try {
      val launch = Intent(
        Intent.ACTION_VIEW,
        Uri.parse("yasliasistani://emergency?reason=" + Uri.encode(reason))
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        setPackage(ctx.packageName)
      }
      ctx.startActivity(launch)
    } catch (_: Exception) {
      val launch = ctx.packageManager.getLaunchIntentForPackage(ctx.packageName)
      launch?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      if (launch != null) ctx.startActivity(launch)
    }
  }

  private fun sendSms(ctx: Context, phone: String, message: String) {
    if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.SEND_SMS)
      != PackageManager.PERMISSION_GRANTED
    ) return

    val cleaned = phone.filter { it.isDigit() || it == '+' }
    if (cleaned.replace(Regex("\\D"), "").length < 7) return

    try {
      val sms = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        ctx.getSystemService(SmsManager::class.java) ?: SmsManager.getDefault()
      } else {
        @Suppress("DEPRECATION")
        SmsManager.getDefault()
      }
      val parts = sms.divideMessage(message)
      if (parts != null && parts.size > 1) {
        sms.sendMultipartTextMessage(cleaned, null, parts, null, null)
      } else {
        sms.sendTextMessage(cleaned, null, message, null, null)
      }
    } catch (_: Exception) {
      // ignore single failure
    }
  }

  private fun dial(ctx: Context, phone: String) {
    val cleaned = phone.filter { it.isDigit() || it == '+' }
    try {
      if (ContextCompat.checkSelfPermission(ctx, Manifest.permission.CALL_PHONE)
        == PackageManager.PERMISSION_GRANTED
      ) {
        val call = Intent(Intent.ACTION_CALL, Uri.parse("tel:$cleaned")).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(call)
      } else {
        val dial = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$cleaned")).apply {
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(dial)
      }
    } catch (_: Exception) {
      // ignore
    }
  }
}
