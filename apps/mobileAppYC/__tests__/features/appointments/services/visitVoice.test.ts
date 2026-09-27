import {DeviceEventEmitter, NativeModules, Platform} from 'react-native';
import {check, request, RESULTS} from 'react-native-permissions';
import {
  cancelVisitVoiceCapture,
  captureVisitVoice,
  isVisitReadBackAvailable,
  isVisitVoiceAvailable,
  onVisitReadBackFinished,
  readVisitText,
  stopReadingVisitText,
} from '../../../../src/features/appointments/services/visitVoice';

const native = {
  addListener: jest.fn(),
  removeListeners: jest.fn(),
  isAvailable: jest.fn(),
  isReadBackAvailable: jest.fn(),
  recognize: jest.fn(),
  cancelRecognition: jest.fn(),
  speak: jest.fn(),
  stopSpeaking: jest.fn(),
};

describe('visitVoice', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(Platform, 'OS', {
      value: 'android',
      configurable: true,
    });
    (NativeModules as any).VisitVoice = native;
    (check as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
    (request as jest.Mock).mockResolvedValue(RESULTS.GRANTED);
    native.isAvailable.mockResolvedValue(true);
    native.isReadBackAvailable.mockResolvedValue(true);
    native.recognize.mockResolvedValue('  Luna coughed twice  ');
    native.cancelRecognition.mockResolvedValue(true);
    native.speak.mockResolvedValue(true);
    native.stopSpeaking.mockResolvedValue(true);
  });

  it('reports read-back availability independently of recognition', async () => {
    native.isAvailable.mockResolvedValueOnce(false);
    await expect(isVisitVoiceAvailable()).resolves.toBe(false);
    await expect(isVisitReadBackAvailable()).resolves.toBe(true);

    native.isReadBackAvailable.mockRejectedValueOnce(new Error('failed'));
    await expect(isVisitReadBackAvailable()).resolves.toBe(false);
  });

  it('subscribes to native read-back completion events', () => {
    const listener = jest.fn();
    const remove = onVisitReadBackFinished(listener);

    DeviceEventEmitter.emit('visitVoiceReadBackFinished');
    expect(listener).toHaveBeenCalledTimes(1);

    remove();
    DeviceEventEmitter.emit('visitVoiceReadBackFinished');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('registers iOS completion events with the native module', () => {
    Object.defineProperty(Platform, 'OS', {value: 'ios', configurable: true});
    const listener = jest.fn();
    const remove = onVisitReadBackFinished(listener);

    expect(native.addListener).toHaveBeenCalledWith(
      'visitVoiceReadBackFinished',
    );
    DeviceEventEmitter.emit('visitVoiceReadBackFinished');
    expect(listener).toHaveBeenCalledTimes(1);

    remove();
    expect(native.removeListeners).toHaveBeenCalledWith(1);
  });

  afterEach(() => {
    delete (NativeModules as any).VisitVoice;
  });

  it('reports native availability and fails closed when the module rejects', async () => {
    await expect(isVisitVoiceAvailable()).resolves.toBe(true);
    native.isAvailable.mockRejectedValueOnce(new Error('unavailable'));
    await expect(isVisitVoiceAvailable()).resolves.toBe(false);
    delete (NativeModules as any).VisitVoice;
    await expect(isVisitVoiceAvailable()).resolves.toBe(false);
  });

  it('captures and trims Android speech after checking microphone permission', async () => {
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'ok',
      text: 'Luna coughed twice',
    });
    expect(check).toHaveBeenCalledWith('android.permission.RECORD_AUDIO');
    expect(request).not.toHaveBeenCalled();
    expect(native.recognize).toHaveBeenCalledWith('en-US');
  });

  it('requests both iOS permissions when needed', async () => {
    Object.defineProperty(Platform, 'OS', {value: 'ios', configurable: true});
    (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);

    await expect(captureVisitVoice('es-ES')).resolves.toEqual({
      status: 'ok',
      text: 'Luna coughed twice',
    });
    expect(request).toHaveBeenNthCalledWith(1, 'ios.permission.MICROPHONE');
    expect(request).toHaveBeenNthCalledWith(
      2,
      'ios.permission.SPEECH_RECOGNITION',
    );
  });

  it('returns denied when a required permission is refused', async () => {
    (check as jest.Mock).mockResolvedValue(RESULTS.DENIED);
    (request as jest.Mock).mockResolvedValue(RESULTS.BLOCKED);
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'denied',
    });
    expect(native.recognize).not.toHaveBeenCalled();
  });

  it('handles missing modules, empty speech, native errors and unsupported platforms', async () => {
    delete (NativeModules as any).VisitVoice;
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'unavailable',
    });

    (NativeModules as any).VisitVoice = native;
    native.recognize.mockResolvedValueOnce('   ');
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'error',
    });
    native.recognize.mockRejectedValueOnce(new Error('failed'));
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'error',
    });

    Object.defineProperty(Platform, 'OS', {value: 'web', configurable: true});
    await expect(captureVisitVoice('en-US')).resolves.toEqual({
      status: 'ok',
      text: 'Luna coughed twice',
    });
    expect(check).not.toHaveBeenCalledWith(expect.stringContaining('web'));
  });

  it('reads and stops text with safe fallbacks', async () => {
    await expect(readVisitText('Question', 'en-US')).resolves.toBe(true);
    expect(native.speak).toHaveBeenCalledWith('Question', 'en-US');
    await expect(stopReadingVisitText()).resolves.toBe(true);

    await expect(readVisitText('   ', 'en-US')).resolves.toBe(false);
    native.speak.mockRejectedValueOnce(new Error('failed'));
    await expect(readVisitText('Question', 'en-US')).resolves.toBe(false);
    native.stopSpeaking.mockRejectedValueOnce(new Error('failed'));
    await expect(stopReadingVisitText()).resolves.toBe(false);

    delete (NativeModules as any).VisitVoice;
    await expect(readVisitText('Question', 'en-US')).resolves.toBe(false);
    await expect(stopReadingVisitText()).resolves.toBe(false);
  });

  it('cancels active recognition with safe fallbacks', async () => {
    await expect(cancelVisitVoiceCapture()).resolves.toBe(true);
    expect(native.cancelRecognition).toHaveBeenCalled();

    native.cancelRecognition.mockRejectedValueOnce(new Error('failed'));
    await expect(cancelVisitVoiceCapture()).resolves.toBe(false);
    delete (NativeModules as any).VisitVoice;
    await expect(cancelVisitVoiceCapture()).resolves.toBe(false);
  });
});
