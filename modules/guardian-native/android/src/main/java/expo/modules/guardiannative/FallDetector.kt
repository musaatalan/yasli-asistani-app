package expo.modules.guardiannative

/**
 * Serbest düşüş → darbe → hareketsizlik (JS FallDetectionService ile aynı mantık).
 */
class FallDetector(private var sensitivity: String = "medium") {

  private enum class Phase { IDLE, FREEFALL, STILLNESS }

  private data class Thresholds(
    val impactG: Double,
    val freefallG: Double,
    val freefallMinMs: Long,
    val freefallToImpactMs: Long,
    val stillnessMs: Long,
    val stillnessBandG: Double,
    val motionDeltaG: Double,
    val cooldownMs: Long
  )

  private val presets = mapOf(
    "high" to Thresholds(2.6, 0.5, 80, 1200, 2000, 0.45, 0.35, 20000),
    "medium" to Thresholds(2.8, 0.45, 100, 1000, 2000, 0.4, 0.4, 25000),
    "low" to Thresholds(3.0, 0.4, 120, 900, 2000, 0.35, 0.45, 30000)
  )

  private var phase = Phase.IDLE
  private var freefallStartedAt: Long? = null
  private var impactAt: Long? = null
  private var lastG = 1.0
  private var stillnessMotionHits = 0
  private var lastTriggerAt = 0L
  private var paused = false

  fun setSensitivity(value: String) {
    sensitivity = value
  }

  fun pause() {
    paused = true
    reset()
  }

  fun resume() {
    paused = false
    reset()
  }

  fun reset() {
    phase = Phase.IDLE
    freefallStartedAt = null
    impactAt = null
    stillnessMotionHits = 0
  }

  fun process(x: Float, y: Float, z: Float): Boolean {
    if (paused) return false
    val t = presets[sensitivity] ?: presets["medium"]!!
    val g = Math.sqrt((x * x + y * y + z * z).toDouble())
    val now = System.currentTimeMillis()
    val delta = Math.abs(g - lastG)
    lastG = g

    when (phase) {
      Phase.IDLE -> {
        if (g <= t.freefallG) {
          phase = Phase.FREEFALL
          freefallStartedAt = now
        }
      }
      Phase.FREEFALL -> {
        val started = freefallStartedAt ?: run {
          reset(); return false
        }
        if (g <= t.freefallG) return false
        val duration = now - started
        if (g >= t.impactG && duration >= t.freefallMinMs) {
          phase = Phase.STILLNESS
          impactAt = now
          stillnessMotionHits = 0
          return false
        }
        if (now - started > t.freefallToImpactMs) {
          reset()
        } else if (g > t.freefallG && g < t.impactG && duration < t.freefallMinMs) {
          reset()
        }
      }
      Phase.STILLNESS -> {
        val impact = impactAt ?: run {
          reset(); return false
        }
        val elapsed = now - impact
        val movedFromGravity = Math.abs(g - 1) > t.stillnessBandG
        val suddenMove = delta > t.motionDeltaG
        val secondaryImpact = g >= t.impactG * 0.85
        if ((movedFromGravity && suddenMove) || secondaryImpact) {
          reset()
          return false
        }
        if (movedFromGravity || suddenMove) {
          stillnessMotionHits += 1
          if (stillnessMotionHits >= 3) {
            reset()
            return false
          }
        }
        if (elapsed >= t.stillnessMs) {
          if (now - lastTriggerAt < t.cooldownMs) {
            reset()
            return false
          }
          lastTriggerAt = now
          reset()
          return true
        }
      }
    }
    return false
  }
}
