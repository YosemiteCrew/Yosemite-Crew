package com.mobileappyc.assistant

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** React Native access to the snapshot store and app shortcuts. */
class AssistantSnapshotBridgeModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = NAME

    @ReactMethod
    fun writeSnapshot(json: String, promise: Promise) {
        promise.resolve(AssistantSnapshotStore.write(reactApplicationContext, json))
    }

    @ReactMethod
    fun clearSnapshot(promise: Promise) {
        AssistantSnapshotStore.clear(reactApplicationContext)
        promise.resolve(true)
    }

    @ReactMethod
    fun consumePendingLink(promise: Promise) {
        promise.resolve(AssistantSnapshotStore.consumePendingLink(reactApplicationContext))
    }

    @ReactMethod
    fun publishShortcuts(json: String, promise: Promise) {
        promise.resolve(AssistantShortcuts.publish(reactApplicationContext, json))
    }

    companion object {
        const val NAME = "AssistantSnapshotBridge"
    }
}
