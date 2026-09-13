package expo.modules.guardiannative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class GuardianBootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (!GuardianPrefs.isEnabled(context)) return
    GuardianForegroundService.start(context)
  }
}
