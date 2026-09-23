package com.mobileappyc.applock

import android.os.SystemClock
import androidx.fragment.app.DialogFragment
import androidx.fragment.app.FragmentActivity
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * React Native access to app lock's native pieces. The JavaScript wrapper is
 * src/features/appLock/services/privacyScreen.ts.
 */
class AppLockModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    /** Milliseconds since boot, counting deep sleep. Settings cannot change it. */
    @ReactMethod
    fun monotonicNow(promise: Promise) {
        promise.resolve(SystemClock.elapsedRealtime().toDouble())
    }

    @ReactMethod
    fun setPrivacy(enabled: Boolean, timeoutMs: Double, promise: Promise) {
        AppLockGuard.setPrivacy(reactApplicationContext, enabled, timeoutMs.toLong())
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.resolve(true)
            return
        }
        activity.runOnUiThread {
            AppLockGuard.applyRecentsPolicy(activity)
            promise.resolve(true)
        }
    }

    /** Android has no native cover to take down; the recents flag covers it. */
    @ReactMethod
    fun coverRendered(promise: Promise) {
        promise.resolve(true)
    }

    /** Closes dialog fragments (alerts, date pickers) on the current activity. */
    @ReactMethod
    fun dismissSystemSheets(promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? FragmentActivity
        if (activity == null) {
            promise.resolve(false)
            return
        }
        activity.runOnUiThread {
            activity.supportFragmentManager.fragments
                .filterIsInstance<DialogFragment>()
                .forEach { it.dismissAllowingStateLoss() }
            promise.resolve(true)
        }
    }

    companion object {
        const val NAME = "AppLock"
    }
}
