package com.mobileappyc.assistant

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.core.content.pm.ShortcutInfoCompat
import androidx.core.content.pm.ShortcutManagerCompat
import androidx.core.graphics.drawable.IconCompat
import com.mobileappyc.R
import org.json.JSONArray
import org.json.JSONException

/**
 * Publishes the action catalogue as Android app shortcuts.
 *
 * This is the shipping route for OS-level actions on Android today. Google's
 * AppFunctions, which is what lets Gemini call an app's actions directly, is
 * an experimental preview limited to Android 16 and a short device list, so it
 * is deliberately not wired here yet. Shortcuts reach every supported device,
 * appear on long-press and in launcher search, and carry the same deep links
 * the iOS intents use.
 */
object AssistantShortcuts {
    private const val MAX_SHORTCUTS = 4

    /**
     * Replaces the published set.
     *
     * Returns false when the payload cannot be read, so the JavaScript caller
     * can tell a bad payload from a platform that refused.
     */
    fun publish(context: Context, json: String): Boolean {
        val entries = try {
            JSONArray(json)
        } catch (error: JSONException) {
            return false
        }

        val shortcuts = mutableListOf<ShortcutInfoCompat>()
        val limit = minOf(entries.length(), MAX_SHORTCUTS)
        for (index in 0 until limit) {
            val entry = entries.optJSONObject(index) ?: continue
            val id = entry.optString("id")
            val label = entry.optString("label")
            val link = entry.optString("link")
            if (id.isEmpty() || label.isEmpty() || link.isEmpty()) {
                continue
            }

            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(link)).apply {
                setPackage(context.packageName)
            }

            shortcuts.add(
                ShortcutInfoCompat.Builder(context, id)
                    .setShortLabel(label)
                    .setLongLabel(entry.optString("longLabel", label))
                    .setIcon(IconCompat.createWithResource(context, R.mipmap.ic_launcher))
                    .setIntent(intent)
                    .build()
            )
        }

        if (shortcuts.isEmpty()) {
            ShortcutManagerCompat.removeAllDynamicShortcuts(context)
            return true
        }

        return ShortcutManagerCompat.setDynamicShortcuts(context, shortcuts)
    }
}
