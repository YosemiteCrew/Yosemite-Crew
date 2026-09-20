package com.mobileappyc.applock

import android.app.Activity
import android.app.Application
import android.content.Context
import android.content.Intent
import android.content.SharedPreferences
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.os.SystemClock

/**
 * The native side of app lock on Android.
 *
 * Keeps the privacy flag in SharedPreferences so it applies before any
 * JavaScript runs, blanks the recents thumbnail on Android 13 and up, and
 * brings MainActivity back to the front when the app returns after the lock
 * timeout with something else on top. Another app's sheet (the share chooser,
 * for example) keeps MainActivity from resuming, so without this the app would
 * never get to run its own lock check.
 *
 * Uses only Application.ActivityLifecycleCallbacks, a platform API, so it adds
 * no dependency.
 */
object AppLockGuard : Application.ActivityLifecycleCallbacks {
    private const val PREFS = "app_lock"
    private const val KEY_ENABLED = "privacyEnabled"
    private const val KEY_TIMEOUT_MS = "timeoutMs"
    private const val DEFAULT_TIMEOUT_MS = 60_000L
    private const val NOT_BACKGROUNDED = -1L

    private val mainHandler = Handler(Looper.getMainLooper())
    private var mainActivityClass: Class<out Activity>? = null

    // Touched only from lifecycle callbacks, which run on the main thread.
    private var startedActivities = 0
    private var backgroundedAt = NOT_BACKGROUNDED
    private var mainActivityResumed = false

    /** Called once from Application.onCreate, before any activity exists. */
    fun install(application: Application, mainActivity: Class<out Activity>) {
        mainActivityClass = mainActivity
        application.registerActivityLifecycleCallbacks(this)
    }

    fun setPrivacy(context: Context, enabled: Boolean, timeoutMs: Long) {
        prefs(context).edit()
            .putBoolean(KEY_ENABLED, enabled)
            .putLong(KEY_TIMEOUT_MS, timeoutMs.coerceAtLeast(0L))
            .apply()
    }

    private fun isEnabled(context: Context): Boolean =
        prefs(context).getBoolean(KEY_ENABLED, false)

    private fun timeoutMs(context: Context): Long =
        prefs(context).getLong(KEY_TIMEOUT_MS, DEFAULT_TIMEOUT_MS)

    private fun prefs(context: Context): SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Keeps app content out of the recents thumbnail for everyone, whether or
     * not app lock is on. Runs for every activity as it is created, so it
     * survives MainActivity being recreated for a locale or font-size change.
     */
    fun applyRecentsPolicy(activity: Activity) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.setRecentsScreenshotEnabled(false)
        }
    }

    override fun onActivityCreated(activity: Activity, savedInstanceState: Bundle?) {
        applyRecentsPolicy(activity)
    }

    override fun onActivityStarted(activity: Activity) {
        startedActivities += 1
        if (startedActivities == 1) {
            onReturnToForeground(activity)
        }
    }

    override fun onActivityResumed(activity: Activity) {
        if (activity.javaClass == mainActivityClass) {
            mainActivityResumed = true
        }
    }

    override fun onActivityPaused(activity: Activity) {
        if (activity.javaClass == mainActivityClass) {
            mainActivityResumed = false
        }
    }

    override fun onActivityStopped(activity: Activity) {
        startedActivities = (startedActivities - 1).coerceAtLeast(0)
        if (startedActivities == 0) {
            backgroundedAt = SystemClock.elapsedRealtime()
        }
    }

    override fun onActivitySaveInstanceState(activity: Activity, outState: Bundle) = Unit

    override fun onActivityDestroyed(activity: Activity) = Unit

    private fun onReturnToForeground(activity: Activity) {
        val since = backgroundedAt
        backgroundedAt = NOT_BACKGROUNDED
        val main = mainActivityClass ?: return
        if (since == NOT_BACKGROUNDED || !isEnabled(activity)) {
            return
        }
        if (SystemClock.elapsedRealtime() - since < timeoutMs(activity)) {
            return
        }
        // Let this start finish. If MainActivity is on top it resumes in the
        // same pass; if it has not, something else is covering it.
        mainHandler.post {
            if (!mainActivityResumed && !activity.isFinishing) {
                // MainActivity is singleTask, so this also closes whatever
                // sits above it in the task.
                activity.startActivity(Intent(activity, main))
            }
        }
    }
}
