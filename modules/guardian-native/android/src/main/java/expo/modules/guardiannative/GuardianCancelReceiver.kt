package expo.modules.guardiannative

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

class GuardianCancelReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    val cancel = Intent(context, GuardianForegroundService::class.java).apply {
      action = GuardianForegroundService.ACTION_CANCEL_ALERT
    }
    context.startService(cancel)
  }
}
