package com.mobileappyc.assistant

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONException
import org.json.JSONObject

/**
 * The offline answer sheet shared with the OS.
 *
 * Android app shortcuts and, in future, AppFunctions run without the React
 * Native bridge attached, so JavaScript keeps a small current copy of the few
 * facts those surfaces can state. It holds no tokens and no clinical notes.
 */
object AssistantSnapshotStore {
    private const val PREFS = "yc_assistant"
    private const val KEY_SNAPSHOT = "snapshot_v1"
    private const val KEY_PENDING_LINK = "pending_link_v1"

    private fun prefs(context: Context): SharedPreferences =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    /**
     * Stores the snapshot, rejecting anything that is not the expected object.
     *
     * A half-written payload is dropped rather than stored, because a shortcut
     * reading it would otherwise present something wrong with confidence.
     */
    fun write(context: Context, json: String): Boolean {
        val parsed = try {
            JSONObject(json)
        } catch (error: JSONException) {
            return false
        }
        if (!parsed.has("version") || !parsed.has("pets")) {
            return false
        }
        prefs(context).edit().putString(KEY_SNAPSHOT, json).apply()
        return true
    }

    fun clear(context: Context) {
        prefs(context).edit().remove(KEY_SNAPSHOT).apply()
    }

    fun read(context: Context): JSONObject? {
        val raw = prefs(context).getString(KEY_SNAPSHOT, null) ?: return null
        return try {
            JSONObject(raw)
        } catch (error: JSONException) {
            null
        }
    }

    fun setPendingLink(context: Context, link: String) {
        prefs(context).edit().putString(KEY_PENDING_LINK, link).apply()
    }

    /** Reads and clears together, so a link is never acted on twice. */
    fun consumePendingLink(context: Context): String {
        val link = prefs(context).getString(KEY_PENDING_LINK, "") ?: ""
        prefs(context).edit().remove(KEY_PENDING_LINK).apply()
        return link
    }
}
