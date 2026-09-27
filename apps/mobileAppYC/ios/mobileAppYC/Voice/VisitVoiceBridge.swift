import AVFoundation
import Foundation
import React
import Speech

@objc(VisitVoice)
final class VisitVoiceBridge: RCTEventEmitter, AVSpeechSynthesizerDelegate {
  private let audioEngine = AVAudioEngine()
  private let synthesizer = AVSpeechSynthesizer()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var recognitionResolve: RCTPromiseResolveBlock?
  private var recognitionReject: RCTPromiseRejectBlock?
  private var recognitionEndTimer: Timer?
  private var tapInstalled = false

  override init() {
    super.init()
    synthesizer.delegate = self
  }

  @objc override static func requiresMainQueueSetup() -> Bool {
    return false
  }

  override func supportedEvents() -> [String]! {
    return ["visitVoiceReadBackFinished"]
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(SFSpeechRecognizer()?.isAvailable ?? false)
  }

  @objc(isReadBackAvailable:rejecter:)
  func isReadBackAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(!AVSpeechSynthesisVoice.speechVoices().isEmpty)
  }

  @objc(recognize:resolver:rejecter:)
  func recognize(
    _ locale: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard self.recognitionResolve == nil else {
        reject("voice_busy", "Speech recognition is already active.", nil)
        return
      }
      guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: locale)),
            recognizer.isAvailable else {
        reject("voice_unavailable", "Speech recognition is unavailable.", nil)
        return
      }

      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(
          .playAndRecord,
          mode: .measurement,
          options: [.defaultToSpeaker, .duckOthers]
        )
        try session.setActive(true)

        let request = SFSpeechAudioBufferRecognitionRequest()
        request.shouldReportPartialResults = true
        self.recognitionRequest = request
        self.recognitionResolve = resolve
        self.recognitionReject = reject

        let input = self.audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { buffer, _ in
          request.append(buffer)
        }
        self.tapInstalled = true
        self.audioEngine.prepare()
        try self.audioEngine.start()
        self.scheduleRecognitionEnd(after: 4)

        self.recognitionTask = recognizer.recognitionTask(with: request) { result, error in
          if let result, result.isFinal {
            self.finishRecognition(text: result.bestTranscription.formattedString)
          } else if result != nil {
            self.scheduleRecognitionEnd(after: 1.5)
          } else if let error {
            self.finishRecognition(error: error)
          }
        }
      } catch {
        self.finishRecognition(error: error)
      }
    }
  }

  private func scheduleRecognitionEnd(after delay: TimeInterval) {
    DispatchQueue.main.async { [weak self] in
      guard let self else { return }
      self.recognitionEndTimer?.invalidate()
      self.recognitionEndTimer = Timer.scheduledTimer(withTimeInterval: delay, repeats: false) {
        [weak self] _ in
        guard let self else { return }
        self.audioEngine.stop()
        self.recognitionRequest?.endAudio()
        self.recognitionTask?.finish()
      }
    }
  }

  private func finishRecognition(text: String? = nil, error: Error? = nil) {
    DispatchQueue.main.async {
      self.recognitionEndTimer?.invalidate()
      self.recognitionEndTimer = nil
      self.audioEngine.stop()
      self.recognitionRequest?.endAudio()
      self.recognitionTask?.cancel()
      if self.tapInstalled {
        self.audioEngine.inputNode.removeTap(onBus: 0)
        self.tapInstalled = false
      }
      try? AVAudioSession.sharedInstance().setActive(
        false,
        options: .notifyOthersOnDeactivation
      )

      let resolve = self.recognitionResolve
      let reject = self.recognitionReject
      self.recognitionRequest = nil
      self.recognitionTask = nil
      self.recognitionResolve = nil
      self.recognitionReject = nil

      if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
        resolve?(text)
      } else {
        reject?("voice_error", "Speech recognition failed.", error)
      }
    }
  }

  @objc(speak:locale:resolver:rejecter:)
  func speak(
    _ text: String,
    locale: String,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      do {
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .spokenAudio, options: .duckOthers)
        try session.setActive(true)

        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: locale)
        self.synthesizer.stopSpeaking(at: .immediate)
        self.synthesizer.speak(utterance)
        resolve(true)
      } catch {
        reject("speech_unavailable", "Text to speech is unavailable.", error)
      }
    }
  }

  @objc(stopSpeaking:rejecter:)
  func stopSpeaking(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      self.synthesizer.stopSpeaking(at: .immediate)
      resolve(true)
    }
  }

  func speechSynthesizer(
    _: AVSpeechSynthesizer,
    didFinish _: AVSpeechUtterance
  ) {
    finishReadBack()
  }

  func speechSynthesizer(
    _: AVSpeechSynthesizer,
    didCancel _: AVSpeechUtterance
  ) {
    finishReadBack()
  }

  private func finishReadBack() {
    try? AVAudioSession.sharedInstance().setActive(
      false,
      options: .notifyOthersOnDeactivation
    )
    sendEvent(withName: "visitVoiceReadBackFinished", body: nil)
  }
}
