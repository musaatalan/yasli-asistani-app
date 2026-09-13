package expo.modules.guardiannative

import android.content.Context

object GuardianPrefs {
  private const val PREFS = "yasli_guardian_prefs"

  const val KEY_ENABLED = "enabled"
  const val KEY_FALL_ENABLED = "fall_enabled"
  const val KEY_VOICE_ENABLED = "voice_enabled"
  const val KEY_SENSITIVITY = "sensitivity"
  const val KEY_COUNTDOWN = "countdown_seconds"
  const val KEY_PHONES = "phones"
  const val KEY_PRIMARY = "primary_phone"
  const val KEY_MESSAGE = "emergency_message"

  private fun prefs(ctx: Context) =
    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

  fun setConfig(
    ctx: Context,
    enabled: Boolean,
    fallEnabled: Boolean,
    voiceEnabled: Boolean,
    sensitivity: String,
    countdownSeconds: Int,
    phones: String,
    primaryPhone: String,
    message: String
  ) {
    prefs(ctx).edit()
      .putBoolean(KEY_ENABLED, enabled)
      .putBoolean(KEY_FALL_ENABLED, fallEnabled)
      .putBoolean(KEY_VOICE_ENABLED, voiceEnabled)
      .putString(KEY_SENSITIVITY, sensitivity)
      .putInt(KEY_COUNTDOWN, countdownSeconds)
      .putString(KEY_PHONES, phones)
      .putString(KEY_PRIMARY, primaryPhone)
      .putString(KEY_MESSAGE, message)
      .apply()
  }

  fun isEnabled(ctx: Context) = prefs(ctx).getBoolean(KEY_ENABLED, false)
  fun isFallEnabled(ctx: Context) = prefs(ctx).getBoolean(KEY_FALL_ENABLED, true)
  fun isVoiceEnabled(ctx: Context) = prefs(ctx).getBoolean(KEY_VOICE_ENABLED, true)
  fun sensitivity(ctx: Context) = prefs(ctx).getString(KEY_SENSITIVITY, "medium") ?: "medium"
  fun countdownSeconds(ctx: Context) = prefs(ctx).getInt(KEY_COUNTDOWN, 10)
  fun phones(ctx: Context) =
    (prefs(ctx).getString(KEY_PHONES, "") ?: "")
      .split(',', ';')
      .map { it.trim() }
      .filter { it.replace(Regex("\\D"), "").length >= 7 }
  fun primaryPhone(ctx: Context) = prefs(ctx).getString(KEY_PRIMARY, "") ?: ""
  fun message(ctx: Context) =
    prefs(ctx).getString(KEY_MESSAGE, "ACİL DURUM! Güvenli Yaşlı Asistanı yardım çağrısı.")
      ?: "ACİL DURUM! Güvenli Yaşlı Asistanı yardım çağrısı."
}
