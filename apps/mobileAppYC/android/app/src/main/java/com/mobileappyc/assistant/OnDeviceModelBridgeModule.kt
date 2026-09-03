package com.mobileappyc.assistant

import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * Android's on-device language model, as the assistant sees it.
 *
 * The assistant answers from its own rule parser and resolvers on every
 * device; a platform model only ever rephrases an answer that is already true
 * or rescues an unrouted phrase. So reporting "unavailable" here costs
 * phrasing, never correctness, and the whole feature works without it.
 *
 * Gemini Nano is reached through ML Kit's GenAI Prompt API. That dependency is
 * deliberately not wired in yet, and the reasons are worth writing down:
 *
 *  - The artifact declares `minSdkVersion 26` while this app ships `minSdk 24`,
 *    so adopting it means either raising the app's floor or overriding the
 *    merge and guarding every call.
 *  - It reaches AICore, which exists only on recent flagships (Pixel 8 and
 *    later, Galaxy S24 and later). No emulator image exposes it, so the
 *    integration cannot be exercised on CI or on any simulator in the build
 *    fleet.
 *  - It is a beta API with no deprecation policy, and it pulls a large
 *    transitive tree including its own play-services-basement pin.
 *
 * Until that is taken on deliberately, this module reports the same honest
 * state a non-Gemini device would report, and the UI explains it to the owner.
 */
class OnDeviceModelBridgeModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun isAvailable(promise: Promise) {
        val result = Arguments.createMap()
        result.putBoolean("available", false)
        result.putString("providerLabel", PROVIDER_LABEL)
        result.putString(
            "reason",
            if (Build.VERSION.SDK_INT < MIN_GENAI_SDK) "unsupportedOS" else "unsupportedDevice"
        )
        promise.resolve(result)
    }

    @ReactMethod
    fun generate(prompt: String, maxTokens: Int, promise: Promise) {
        // The JavaScript caller treats a rejection as "no model help this
        // turn" and falls back to the rule-based reply.
        promise.reject(ERROR_CODE, "No on-device model on this device")
    }

    companion object {
        const val NAME = "OnDeviceModelBridge"
        private const val PROVIDER_LABEL = "Gemini Nano"

        /** The API level ML Kit's GenAI artifacts require. */
        private const val MIN_GENAI_SDK = 26
        private const val ERROR_CODE = "on_device_model_unavailable"
    }
}
