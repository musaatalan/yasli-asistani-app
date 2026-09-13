package expo.modules.guardiannative

import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import java.util.Locale

/**
 * Arka planda Türkçe İMDAT / YARDIM / SOS dinler.
 * Google SpeechRecognizer servis içinde sürekli yeniden başlatılır.
 */
class VoiceKeywordListener(
  private val context: Context,
  private val onEmergency: () -> Unit
) {
  private val mainHandler = Handler(Looper.getMainLooper())
  private var recognizer: SpeechRecognizer? = null
  private var running = false
  private var lastTriggerAt = 0L

  private val phrases = listOf(
    "imdat", "yardim", "yardim edin", "yardim et", "sos", "kurtarin", "kurtar"
  )

  fun start() {
    if (running) return
    if (!SpeechRecognizer.isRecognitionAvailable(context)) return
    running = true
    mainHandler.post { ensureRecognizer(); begin() }
  }

  fun stop() {
    running = false
    mainHandler.post {
      try {
        recognizer?.cancel()
        recognizer?.destroy()
      } catch (_: Exception) {
      }
      recognizer = null
    }
  }

  private fun ensureRecognizer() {
    if (recognizer != null) return
    recognizer = SpeechRecognizer.createSpeechRecognizer(context).apply {
      setRecognitionListener(listener)
    }
  }

  private fun begin() {
    if (!running) return
    try {
      ensureRecognizer()
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
        putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
        putExtra(RecognizerIntent.EXTRA_LANGUAGE, "tr-TR")
        putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 3)
        putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, context.packageName)
      }
      recognizer?.startListening(intent)
    } catch (_: Exception) {
      scheduleRestart(800)
    }
  }

  private fun scheduleRestart(delayMs: Long) {
    if (!running) return
    mainHandler.postDelayed({
      if (running) begin()
    }, delayMs)
  }

  private fun normalize(text: String): String {
    return text.lowercase(Locale("tr", "TR"))
      .replace('ı', 'i')
      .replace('İ', 'i')
      .replace('ğ', 'g')
      .replace('ü', 'u')
      .replace('ş', 's')
      .replace('ö', 'o')
      .replace('ç', 'c')
      .replace(Regex("[^a-z0-9\\s]"), " ")
      .replace(Regex("\\s+"), " ")
      .trim()
  }

  private fun matches(text: String): Boolean {
    val n = normalize(text)
    if (n.isEmpty()) return false
    return phrases.any { p -> n == p || n.contains(p) }
  }

  private fun maybeTrigger() {
    val now = System.currentTimeMillis()
    if (now - lastTriggerAt < 15000) return
    lastTriggerAt = now
    onEmergency()
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {}
    override fun onBeginningOfSpeech() {}
    override fun onRmsChanged(rmsdB: Float) {}
    override fun onBufferReceived(buffer: ByteArray?) {}
    override fun onEndOfSpeech() {
      scheduleRestart(300)
    }

    override fun onError(error: Int) {
      // 7=NO_MATCH, 6=SPEECH_TIMEOUT — normal; yeniden dinle
      val delay = if (error == SpeechRecognizer.ERROR_RECOGNIZER_BUSY) 1200L else 400L
      scheduleRestart(delay)
    }

    override fun onResults(results: Bundle?) {
      val list = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
      if (list.any { matches(it) }) maybeTrigger()
      scheduleRestart(350)
    }

    override fun onPartialResults(partialResults: Bundle?) {
      val list = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION).orEmpty()
      if (list.any { matches(it) }) maybeTrigger()
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }
}
