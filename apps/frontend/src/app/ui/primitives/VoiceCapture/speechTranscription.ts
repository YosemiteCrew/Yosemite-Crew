'use client';

export type SpeechTranscriptionErrorCode =
  | 'not-allowed'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'aborted'
  | 'language-not-supported'
  | 'service-not-allowed'
  | 'unknown';

export interface SpeechTranscriptionError {
  code: SpeechTranscriptionErrorCode;
  message: string;
}

export type SpeechTranscriptionEvents = {
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (error: SpeechTranscriptionError) => void;
  onStart?: () => void;
  onEnd?: () => void;
};

export interface SpeechTranscriptionAdapter {
  readonly id: string;
  isSupported(): boolean;
  start(events: SpeechTranscriptionEvents): void;
  stop(): void;
  abort(): void;
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

interface SpeechRecognitionResultEventLike {
  resultIndex: number;
  results: ReadonlyArray<{
    isFinal: boolean;
    0: { transcript: string };
  }>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

const readWindowSpeechRecognition = (): SpeechRecognitionConstructor | null => {
  const w = globalThis.window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

const errorMessageForCode = (code: SpeechTranscriptionErrorCode): string => {
  switch (code) {
    case 'not-allowed':
      return 'Microphone access was denied. Check your browser permissions and try again.';
    case 'audio-capture':
      return 'Could not start audio capture. Check that a microphone is connected.';
    case 'network':
      return 'Speech recognition needs a network connection. Try again when online.';
    case 'language-not-supported':
      return 'Speech recognition is not available for this language.';
    case 'service-not-allowed':
      return 'Speech recognition is not allowed by this browser or origin.';
    default:
      return 'Voice capture failed. Try again.';
  }
};

const translateEngineError = (engineError: string): SpeechTranscriptionError => {
  switch (engineError) {
    case 'not-allowed':
    case 'service-not-allowed':
      return { code: engineError, message: errorMessageForCode(engineError) };
    case 'audio-capture':
      return { code: 'audio-capture', message: errorMessageForCode('audio-capture') };
    case 'network':
      return { code: 'network', message: errorMessageForCode('network') };
    case 'language-not-supported':
      return {
        code: 'language-not-supported',
        message: errorMessageForCode('language-not-supported'),
      };
    default:
      return { code: 'unknown', message: errorMessageForCode('unknown') };
  }
};

export class WebSpeechTranscriptionAdapter implements SpeechTranscriptionAdapter {
  readonly id = 'web-speech';

  private recognition: SpeechRecognitionLike | null = null;
  private events: SpeechTranscriptionEvents = {};
  private shouldRestart = false;
  private manualStopRequested = false;
  private streamingInterim = '';

  isSupported(): boolean {
    return readWindowSpeechRecognition() !== null;
  }

  start(events: SpeechTranscriptionEvents): void {
    const Ctor = readWindowSpeechRecognition();
    if (!Ctor) {
      events.onError?.({ code: 'unknown', message: errorMessageForCode('unknown') });
      return;
    }

    this.events = events;
    this.manualStopRequested = false;
    this.streamingInterim = '';

    const recognition = new Ctor();
    recognition.lang = globalThis.navigator.language ?? 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      this.events.onStart?.();
    };

    recognition.onresult = (event) => {
      let interim = '';
      const finalPieces: string[] = [];

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalPieces.push(result[0].transcript);
        } else {
          interim += result[0].transcript;
        }
      }

      if (finalPieces.length > 0) {
        this.streamingInterim = '';
        this.events.onFinal?.(finalPieces.join(' ').trim());
      }

      const displayedInterim = interim.trim();
      if (displayedInterim !== this.streamingInterim) {
        this.streamingInterim = displayedInterim;
        this.events.onInterim?.(displayedInterim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      this.shouldRestart = false;
      this.events.onError?.(translateEngineError(event.error));
    };

    recognition.onend = () => {
      if (this.manualStopRequested) {
        this.events.onEnd?.();
        return;
      }
      if (this.shouldRestart) {
        try {
          recognition.start();
          return;
        } catch {
          this.events.onEnd?.();
          return;
        }
      }
      this.events.onEnd?.();
    };

    recognition.start();
    this.recognition = recognition;
    this.shouldRestart = true;
  }

  stop(): void {
    this.manualStopRequested = true;
    this.shouldRestart = false;
    this.recognition?.stop();
  }

  abort(): void {
    this.manualStopRequested = true;
    this.shouldRestart = false;
    this.recognition?.abort();
  }
}
