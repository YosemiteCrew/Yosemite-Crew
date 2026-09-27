package com.mobileappyc.voice

import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class VisitVoiceModule(
    reactContext: ReactApplicationContext
) : ReactContextBaseJavaModule(reactContext) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private var recognizer: SpeechRecognizer? = null
    private var recognitionPromise: Promise? = null
    private var textToSpeech: TextToSpeech? = null

    override fun getName(): String = NAME

    @ReactMethod
    fun isAvailable(promise: Promise) {
        promise.resolve(SpeechRecognizer.isRecognitionAvailable(reactApplicationContext))
    }

    @ReactMethod
    fun recognize(locale: String, promise: Promise) {
        mainHandler.post {
            if (recognitionPromise != null) {
                promise.reject("voice_busy", "Speech recognition is already active.")
                return@post
            }
            if (!SpeechRecognizer.isRecognitionAvailable(reactApplicationContext)) {
                promise.reject("voice_unavailable", "Speech recognition is unavailable.")
                return@post
            }

            recognitionPromise = promise
            recognizer = SpeechRecognizer.createSpeechRecognizer(reactApplicationContext).also {
                it.setRecognitionListener(listener)
                it.startListening(
                    Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
                        putExtra(
                            RecognizerIntent.EXTRA_LANGUAGE_MODEL,
                            RecognizerIntent.LANGUAGE_MODEL_FREE_FORM
                        )
                        putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
                        putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1)
                    }
                )
            }
        }
    }

    private val listener = object : RecognitionListener {
        override fun onResults(results: Bundle) {
            val text = results
                .getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)
                ?.firstOrNull()
                .orEmpty()
            if (text.isBlank()) {
                finishRecognition("voice_empty", "No speech was recognized.")
            } else {
                val promise = recognitionPromise
                clearRecognition()
                promise?.resolve(text)
            }
        }

        override fun onError(error: Int) {
            finishRecognition("voice_error", "Speech recognition failed ($error).")
        }

        override fun onReadyForSpeech(params: Bundle?) = Unit
        override fun onBeginningOfSpeech() = Unit
        override fun onRmsChanged(rmsdB: Float) = Unit
        override fun onBufferReceived(buffer: ByteArray?) = Unit
        override fun onEndOfSpeech() = Unit
        override fun onPartialResults(partialResults: Bundle?) = Unit
        override fun onEvent(eventType: Int, params: Bundle?) = Unit
    }

    private fun finishRecognition(code: String, message: String) {
        val promise = recognitionPromise
        clearRecognition()
        promise?.reject(code, message)
    }

    private fun clearRecognition() {
        recognizer?.destroy()
        recognizer = null
        recognitionPromise = null
    }

    @ReactMethod
    fun speak(text: String, locale: String, promise: Promise) {
        mainHandler.post {
            textToSpeech?.let {
                speakWith(it, text, locale, promise)
                return@post
            }
            textToSpeech = TextToSpeech(reactApplicationContext) { status ->
                val engine = textToSpeech
                if (status != TextToSpeech.SUCCESS || engine == null) {
                    promise.reject("speech_unavailable", "Text to speech is unavailable.")
                } else {
                    speakWith(engine, text, locale, promise)
                }
            }
        }
    }

    private fun speakWith(
        engine: TextToSpeech,
        text: String,
        locale: String,
        promise: Promise
    ) {
        engine.language = Locale.forLanguageTag(locale)
        promise.resolve(
            engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "visit-preparation") ==
                TextToSpeech.SUCCESS
        )
    }

    @ReactMethod
    fun stopSpeaking(promise: Promise) {
        promise.resolve(textToSpeech?.stop()?.let { it != TextToSpeech.ERROR } ?: false)
    }

    override fun invalidate() {
        clearRecognition()
        textToSpeech?.shutdown()
        textToSpeech = null
        super.invalidate()
    }

    companion object {
        const val NAME = "VisitVoice"
    }
}
