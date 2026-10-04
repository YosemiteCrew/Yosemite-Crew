import { WebSpeechTranscriptionAdapter } from '@/app/ui/primitives/VoiceCapture/speechTranscription';

type MockRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onresult: ((event: unknown) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  start: jest.Mock;
  stop: jest.Mock;
  abort: jest.Mock;
};

let instances: MockRecognition[] = [];

class MockCtor {
  constructor() {
    const instance: MockRecognition = {
      continuous: false,
      interimResults: false,
      lang: '',
      maxAlternatives: 0,
      onresult: null,
      onerror: null,
      onstart: null,
      onend: null,
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
    };
    instance.start = jest.fn(() => {
      instance.onstart?.();
    });
    instances.push(instance);
    return instance;
  }
}

function installSpeechRecognition() {
  Object.defineProperty(globalThis.window, 'SpeechRecognition', {
    value: MockCtor,
    configurable: true,
  });
}

function removeSpeechRecognition() {
  Object.defineProperty(globalThis.window, 'SpeechRecognition', {
    value: undefined,
    configurable: true,
  });
  Object.defineProperty(globalThis.window, 'webkitSpeechRecognition', {
    value: undefined,
    configurable: true,
  });
}

function resultEvent({ isFinal, transcript }: { isFinal: boolean; transcript: string }) {
  return {
    resultIndex: 0,
    results: [{ isFinal, 0: { transcript } }],
  };
}

function call(handler: ((event: unknown) => void) | null, event: unknown) {
  handler?.(event);
}

describe('WebSpeechTranscriptionAdapter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    instances = [];
    installSpeechRecognition();
  });

  afterEach(() => {
    removeSpeechRecognition();
  });

  it('is not supported when no SpeechRecognition constructor exists', () => {
    removeSpeechRecognition();
    const adapter = new WebSpeechTranscriptionAdapter();
    expect(adapter.isSupported()).toBe(false);
  });

  it('is supported when a SpeechRecognition constructor exists', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    expect(adapter.isSupported()).toBe(true);
  });

  it('starts recognition with continuous interim captions and fires onStart', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onStart = jest.fn();
    adapter.start({ onStart });

    expect(instances).toHaveLength(1);
    const recognition = instances[0];
    expect(recognition.continuous).toBe(true);
    expect(recognition.interimResults).toBe(true);
    expect(recognition.maxAlternatives).toBe(1);
    expect(recognition.lang).toBe(globalThis.navigator.language);
    expect(recognition.start).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
  });

  it('emits final transcripts and unique interim updates from result events', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onInterim = jest.fn();
    const onFinal = jest.fn();
    adapter.start({ onInterim, onFinal });

    const recognition = instances[0];
    call(recognition.onresult, {
      resultIndex: 0,
      results: [
        { isFinal: false, 0: { transcript: 'puppy ' } },
        { isFinal: false, 0: { transcript: 'next' } },
      ],
    });
    expect(onInterim).toHaveBeenLastCalledWith('puppy next');

    call(recognition.onresult, resultEvent({ isFinal: true, transcript: 'book a ' }));
    call(recognition.onresult, resultEvent({ isFinal: true, transcript: 'vaccine' }));
    expect(onFinal).toHaveBeenNthCalledWith(1, 'book a');
    expect(onFinal).toHaveBeenNthCalledWith(2, 'vaccine');

    call(recognition.onresult, resultEvent({ isFinal: false, transcript: 'book a vaccine' }));
    expect(onFinal).toHaveBeenCalledTimes(2);
  });

  it('maps engine errors to friendly guided messages', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onError = jest.fn();
    adapter.start({ onError });

    const recognition = instances[0];
    recognition.onerror?.({ error: 'not-allowed' });
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'not-allowed',
        message: expect.stringContaining('Microphone access was denied'),
      })
    );
  });

  it('ignores no-speech and aborted errors so listening continues', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onError = jest.fn();
    adapter.start({ onError });

    const recognition = instances[0];
    recognition.onerror?.({ error: 'no-speech' });
    recognition.onerror?.({ error: 'aborted' });
    expect(onError).not.toHaveBeenCalled();
  });

  it('restarts automatically when the session ends without a manual stop', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onEnd = jest.fn();
    adapter.start({ onEnd });

    const recognition = instances[0];
    call(recognition.onend, undefined);
    expect(recognition.start).toHaveBeenCalledTimes(2);
    expect(onEnd).not.toHaveBeenCalled();
  });

  it('stops restarting and fires onEnd when stop() is called', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onEnd = jest.fn();
    adapter.start({ onEnd });

    const recognition = instances[0];
    adapter.stop();
    expect(recognition.stop).toHaveBeenCalled();
    call(recognition.onend, undefined);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('aborts the underlying recognition on abort()', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    adapter.start({});

    const recognition = instances[0];
    adapter.abort();
    expect(recognition.abort).toHaveBeenCalled();
  });

  it('surfaces an unknown error when started without support', () => {
    removeSpeechRecognition();
    const adapter = new WebSpeechTranscriptionAdapter();
    const onError = jest.fn();
    adapter.start({ onError });

    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'unknown', message: expect.any(String) })
    );
    expect(instances).toHaveLength(0);
  });

  it('maps every remaining engine error to a guided message', () => {
    const cases: Array<[string, string, RegExp]> = [
      ['audio-capture', 'audio-capture', /microphone is connected/i],
      ['network', 'network', /network connection/i],
      ['language-not-supported', 'language-not-supported', /not available for this language/i],
      ['service-not-allowed', 'service-not-allowed', /not allowed by this browser or origin/i],
      ['unexpected-engine-code', 'unknown', /Voice capture failed/i],
    ];

    for (const [engineError, code, messagePattern] of cases) {
      const adapter = new WebSpeechTranscriptionAdapter();
      const onError = jest.fn();
      adapter.start({ onError });

      const recognition = instances[instances.length - 1];
      recognition.onerror?.({ error: engineError });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({ code, message: expect.stringMatching(messagePattern) })
      );
    }
  });

  it('ends instead of restarting when the engine rejects an auto-restart', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onEnd = jest.fn();
    adapter.start({ onEnd });

    const recognition = instances[0];
    recognition.start.mockImplementation(() => {
      throw new Error('engine busy');
    });
    call(recognition.onend, undefined);

    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(recognition.start).toHaveBeenCalledTimes(2);
  });

  it('fires onEnd without restarting when the session ends after a fatal error', () => {
    const adapter = new WebSpeechTranscriptionAdapter();
    const onError = jest.fn();
    const onEnd = jest.fn();
    adapter.start({ onError, onEnd });

    const recognition = instances[0];
    recognition.onerror?.({ error: 'network' });
    call(recognition.onend, undefined);

    expect(onError).toHaveBeenCalled();
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(recognition.start).toHaveBeenCalledTimes(1);
  });

  it('falls back to en-US when the browser locale is missing', () => {
    const original = globalThis.navigator.language;
    Object.defineProperty(globalThis.navigator, 'language', {
      value: undefined,
      configurable: true,
    });
    try {
      const adapter = new WebSpeechTranscriptionAdapter();
      adapter.start({});
      expect(instances[0].lang).toBe('en-US');
    } finally {
      Object.defineProperty(globalThis.navigator, 'language', {
        value: original,
        configurable: true,
      });
    }
  });
});
