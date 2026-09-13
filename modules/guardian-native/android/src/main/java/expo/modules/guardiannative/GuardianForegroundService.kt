package expo.modules.guardiannative

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

/**
 * Uygulama tamamen kapalıyken bile çalışan native koruma servisi.
 * - İvmeölçer düşme algılama
 * - SpeechRecognizer ile İMDAT
 * - Geri sayım sonrası native SMS + arama
 * - onTaskRemoved / START_STICKY ile yeniden ayağa kalkma
 */
class GuardianForegroundService : Service(), SensorEventListener {

  companion object {
    const val NOTIFICATION_ID = 71001
    const val CHANNEL_ID = "yasli_guardian_channel"
    const val ALERT_CHANNEL_ID = "yasli_guardian_alert"
    const val ACTION_START = "expo.modules.guardiannative.START"
    const val ACTION_STOP = "expo.modules.guardiannative.STOP"
    const val ACTION_CANCEL_ALERT = "expo.modules.guardiannative.CANCEL_ALERT"

    @Volatile
    var isRunning: Boolean = false
      private set

    fun start(context: Context) {
      val intent = Intent(context, GuardianForegroundService::class.java).apply {
        action = ACTION_START
      }
      ContextCompatStart.start(context, intent)
    }

    fun stop(context: Context) {
      val intent = Intent(context, GuardianForegroundService::class.java).apply {
        action = ACTION_STOP
      }
      context.startService(intent)
    }
  }

  private var sensorManager: SensorManager? = null
  private var wakeLock: PowerManager.WakeLock? = null
  private val fallDetector = FallDetector()
  private var voiceListener: VoiceKeywordListener? = null
  private val mainHandler = Handler(Looper.getMainLooper())
  private var alertPending = false
  private var countdownRunnable: Runnable? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    createChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    when (intent?.action) {
      ACTION_STOP -> {
        teardown()
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
        return START_NOT_STICKY
      }
      ACTION_CANCEL_ALERT -> {
        cancelAlert()
        return START_STICKY
      }
    }

    if (!GuardianPrefs.isEnabled(this)) {
      stopSelf()
      return START_NOT_STICKY
    }

    startAsForeground()
    acquireWakeLock()
    bindSensorsAndVoice()
    isRunning = true
    return START_STICKY
  }

  override fun onTaskRemoved(rootIntent: Intent?) {
    // Kullanıcı recent'ten kaydırsa bile yeniden başlat
    if (GuardianPrefs.isEnabled(this)) {
      val restart = Intent(applicationContext, GuardianForegroundService::class.java).apply {
        action = ACTION_START
      }
      ContextCompatStart.start(applicationContext, restart)
    }
    super.onTaskRemoved(rootIntent)
  }

  override fun onDestroy() {
    teardown()
    isRunning = false
    // Sticky — sistem yeniden başlatabilir; prefs açıksa tekrar dene
    if (GuardianPrefs.isEnabled(this)) {
      mainHandler.postDelayed({
        if (GuardianPrefs.isEnabled(applicationContext) && !isRunning) {
          start(applicationContext)
        }
      }, 1500)
    }
    super.onDestroy()
  }

  private fun startAsForeground() {
    val notification = buildOngoingNotification()
    val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE or
        ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
    } else {
      0
    }

    try {
      ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, type)
    } catch (_: Exception) {
      // microphone tipi başarısızsa specialUse dene
      try {
        val fallback = if (Build.VERSION.SDK_INT >= 34) {
          ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
        } else 0
        ServiceCompat.startForeground(this, NOTIFICATION_ID, notification, fallback)
      } catch (_: Exception) {
        startForeground(NOTIFICATION_ID, notification)
      }
    }
  }

  private fun buildOngoingNotification(): Notification {
    val open = packageManager.getLaunchIntentForPackage(packageName)
      ?: Intent(Intent.ACTION_VIEW, Uri.parse("yasliasistani://"))
    open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    val pi = PendingIntent.getActivity(
      this, 0, open,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Koruma aktif")
      .setContentText("İmdat dinleniyor · düşme koruması açık")
      .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
      .setOngoing(true)
      .setContentIntent(pi)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setCategory(NotificationCompat.CATEGORY_SERVICE)
      .build()
  }

  private fun createChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    nm.createNotificationChannel(
      NotificationChannel(CHANNEL_ID, "Koruma servisi", NotificationManager.IMPORTANCE_LOW)
    )
    nm.createNotificationChannel(
      NotificationChannel(ALERT_CHANNEL_ID, "Acil geri sayım", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Düşme / imdat geri sayımı"
      }
    )
  }

  private fun acquireWakeLock() {
    if (wakeLock?.isHeld == true) return
    val pm = getSystemService(POWER_SERVICE) as PowerManager
    wakeLock = pm.newWakeLock(
      PowerManager.PARTIAL_WAKE_LOCK,
      "YasliAsistani::GuardianWakeLock"
    ).apply {
      setReferenceCounted(false)
      acquire(6 * 60 * 60 * 1000L) // 6 saat, servis ayakta yeniler
    }
  }

  private fun bindSensorsAndVoice() {
    fallDetector.setSensitivity(GuardianPrefs.sensitivity(this))
    fallDetector.resume()

    if (GuardianPrefs.isFallEnabled(this)) {
      sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
      val accel = sensorManager?.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
      if (accel != null) {
        sensorManager?.registerListener(this, accel, SensorManager.SENSOR_DELAY_GAME)
      }
    }

    voiceListener?.stop()
    voiceListener = null
    if (GuardianPrefs.isVoiceEnabled(this)) {
      voiceListener = VoiceKeywordListener(this) {
        beginAlert("Sesli İMDAT algılandı")
      }
      voiceListener?.start()
    }
  }

  private fun teardown() {
    cancelAlert()
    try {
      sensorManager?.unregisterListener(this)
    } catch (_: Exception) {
    }
    sensorManager = null
    voiceListener?.stop()
    voiceListener = null
    try {
      if (wakeLock?.isHeld == true) wakeLock?.release()
    } catch (_: Exception) {
    }
    wakeLock = null
    isRunning = false
  }

  override fun onSensorChanged(event: SensorEvent?) {
    if (event?.sensor?.type != Sensor.TYPE_ACCELEROMETER) return
    if (alertPending) return
    val x = event.values[0] / SensorManager.GRAVITY_EARTH
    val y = event.values[1] / SensorManager.GRAVITY_EARTH
    val z = event.values[2] / SensorManager.GRAVITY_EARTH
    if (fallDetector.process(x, y, z)) {
      beginAlert("Düşme algılandı")
    }
  }

  override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {}

  private fun beginAlert(reason: String) {
    if (alertPending) return
    alertPending = true
    fallDetector.pause()
    voiceListener?.stop()

    val seconds = GuardianPrefs.countdownSeconds(this).coerceIn(5, 30)
    showAlertNotification(reason, seconds)

    // Uygulamayı aç — JS overlay iptal edebilsin
    try {
      val open = Intent(
        Intent.ACTION_VIEW,
        Uri.parse(
          "yasliasistani://countdown?reason=" + Uri.encode(reason) + "&seconds=$seconds"
        )
      ).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        setPackage(packageName)
      }
      startActivity(open)
    } catch (_: Exception) {
    }

    val r = Runnable {
      if (!alertPending) return@Runnable
      alertPending = false
      EmergencyActions.fire(this, reason)
      fallDetector.resume()
      if (GuardianPrefs.isVoiceEnabled(this)) {
        voiceListener = VoiceKeywordListener(this) {
          beginAlert("Sesli İMDAT algılandı")
        }
        voiceListener?.start()
      }
      // Alert bildirimini kapat, ongoing kalsın
      val nm = getSystemService(NotificationManager::class.java)
      nm.cancel(NOTIFICATION_ID + 1)
    }
    countdownRunnable = r
    mainHandler.postDelayed(r, seconds * 1000L)
  }

  private fun cancelAlert() {
    alertPending = false
    countdownRunnable?.let { mainHandler.removeCallbacks(it) }
    countdownRunnable = null
    fallDetector.resume()
    val nm = getSystemService(NotificationManager::class.java)
    nm.cancel(NOTIFICATION_ID + 1)
    if (GuardianPrefs.isVoiceEnabled(this) && isRunning) {
      voiceListener?.stop()
      voiceListener = VoiceKeywordListener(this) {
        beginAlert("Sesli İMDAT algılandı")
      }
      voiceListener?.start()
    }
  }

  private fun showAlertNotification(reason: String, seconds: Int) {
    val cancelIntent = Intent(this, GuardianCancelReceiver::class.java)
    val cancelPi = PendingIntent.getBroadcast(
      this, 2, cancelIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val n = NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
      .setContentTitle("ACİL — $reason")
      .setContentText("$seconds sn içinde SMS ve arama. İptal için dokunun.")
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setOngoing(true)
      .addAction(0, "İPTAL / İYİYİM", cancelPi)
      .build()
    getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID + 1, n)
  }
}

/** ContextCompat.startForegroundService uyumu */
private object ContextCompatStart {
  fun start(context: Context, intent: Intent) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent)
    } else {
      context.startService(intent)
    }
  }
}
