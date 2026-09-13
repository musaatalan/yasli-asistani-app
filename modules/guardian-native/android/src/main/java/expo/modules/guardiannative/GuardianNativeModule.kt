package expo.modules.guardiannative

import android.content.Intent
import android.net.Uri
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class GuardianNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("GuardianNative")

    AsyncFunction("syncConfig") { config: Map<String, Any?> ->
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      GuardianPrefs.setConfig(
        ctx,
        enabled = config["enabled"] as? Boolean ?: true,
        fallEnabled = config["fallEnabled"] as? Boolean ?: true,
        voiceEnabled = config["voiceEnabled"] as? Boolean ?: true,
        sensitivity = config["sensitivity"] as? String ?: "medium",
        countdownSeconds = (config["countdownSeconds"] as? Number)?.toInt() ?: 10,
        phones = config["phones"] as? String ?: "",
        primaryPhone = config["primaryPhone"] as? String ?: "",
        message = config["message"] as? String
          ?: "ACİL DURUM! Güvenli Yaşlı Asistanı yardım çağrısı."
      )
      true
    }

    AsyncFunction("start") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val prefs = ctx.getSharedPreferences("yasli_guardian_prefs", 0)
      prefs.edit().putBoolean(GuardianPrefs.KEY_ENABLED, true).apply()
      GuardianForegroundService.start(ctx)
      true
    }

    AsyncFunction("stop") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val prefs = ctx.getSharedPreferences("yasli_guardian_prefs", 0)
      prefs.edit().putBoolean(GuardianPrefs.KEY_ENABLED, false).apply()
      GuardianForegroundService.stop(ctx)
      true
    }

    AsyncFunction("cancelAlert") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      val intent = Intent(ctx, GuardianForegroundService::class.java).apply {
        action = GuardianForegroundService.ACTION_CANCEL_ALERT
      }
      ctx.startService(intent)
      true
    }

    Function("isRunning") {
      GuardianForegroundService.isRunning
    }

    AsyncFunction("openBatterySettings") {
      val ctx = appContext.reactContext ?: return@AsyncFunction false
      try {
        val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
          data = Uri.parse("package:${ctx.packageName}")
          addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        ctx.startActivity(intent)
        true
      } catch (_: Exception) {
        try {
          val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
          }
          ctx.startActivity(intent)
          true
        } catch (_: Exception) {
          false
        }
      }
    }
  }
}
