import AVFoundation
import Foundation
import React
import Speech

@objc(VisitVoice)
final class VisitVoiceBridge: NSObject {
  private let audioEngine = AVAudioEngine()
  private let synthesizer = AVSpeechSynthesizer()
  private var recognitionRequest: SFSpeechAudioBufferRecognitionRequest?
  private var recognitionTask: SFSpeechRecognitionTask?
  private var recognitionResolve: RCTPromiseResolveBlock?
  private var recognitionReject: RCTPromiseRejectBlock?
  private var tapInstalled = false

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc(isAvailable:rejecter:)
  func isAvailable(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    resolve(SFSpeechRecognizer()?.isAvailable ?? false)
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
        try session.setCategory(.record, mode: .measurement, options: .duckOthers)
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

        self.recognitionTask = recognizer.recognitionTask(with: request) { result, error in
          if let result, result.isFinal {
            self.finishRecognition(text: result.bestTranscription.formattedString)
          } else if let error {
            self.finishRecognition(error: error)
          }
        }
      } catch {
        self.finishRecognition(error: error)
      }
    }
  }

  private func finishRecognition(text: String? = nil, error: Error? = nil) {
    DispatchQueue.main.async {
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
    rejecter _: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      let utterance = AVSpeechUtterance(string: text)
      utterance.voice = AVSpeechSynthesisVoice(language: locale)
      self.synthesizer.stopSpeaking(at: .immediate)
      self.synthesizer.speak(utterance)
      resolve(true)
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
}
