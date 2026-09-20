/**
 * Tests for the assistant's safe native-module accessors.
 *
 * `nativeBridge` reads `NativeModules` and `Platform` at call time, so every
 * case here re-requires the module through `jest.resetModules()` +
 * `jest.doMock('react-native', ...)` to place it under a different runtime.
 */

type Bridge = typeof import('@/features/assistant/services/nativeBridge');

type LoadOptions = {
  nativeModules?: Record<string, unknown>;
  os?: string;
};

const loadBridge = ({nativeModules = {}, os = 'ios'}: LoadOptions = {}): {
  bridge: Bridge;
  nativeModules: Record<string, unknown>;
} => {
  jest.resetModules();
  jest.doMock('react-native', () => ({
    NativeModules: nativeModules,
    Platform: {OS: os},
  }));
  const bridge =
    require('@/features/assistant/services/nativeBridge') as Bridge;
  return {bridge, nativeModules};
};

const makeSnapshotModule = () => ({
  writeSnapshot: jest.fn().mockResolvedValue(true),
  clearSnapshot: jest.fn().mockResolvedValue(true),
  consumePendingLink: jest.fn().mockResolvedValue(''),
});

const makeOnDeviceModule = () => ({
  isAvailable: jest.fn().mockResolvedValue({available: true}),
  generate: jest.fn().mockResolvedValue('hello'),
});

afterEach(() => {
  jest.dontMock('react-native');
  jest.resetModules();
});

describe('getSnapshotModule', () => {
  it('returns null when AssistantSnapshotBridge is absent', () => {
    const {bridge} = loadBridge({nativeModules: {}});

    expect(bridge.getSnapshotModule()).toBeNull();
  });

  it('returns the exact AssistantSnapshotBridge object when present', () => {
    const snapshot = makeSnapshotModule();
    const {bridge} = loadBridge({
      nativeModules: {AssistantSnapshotBridge: snapshot},
    });

    expect(bridge.getSnapshotModule()).toBe(snapshot);
  });

  it('returns a module whose methods are callable through the accessor', async () => {
    const snapshot = makeSnapshotModule();
    const {bridge} = loadBridge({
      nativeModules: {AssistantSnapshotBridge: snapshot},
    });

    await expect(
      bridge.getSnapshotModule()?.writeSnapshot('{"pets":[]}'),
    ).resolves.toBe(true);
    expect(snapshot.writeSnapshot).toHaveBeenCalledWith('{"pets":[]}');
  });

  it('does not fall back to the on-device model module', () => {
    const {bridge} = loadBridge({
      nativeModules: {OnDeviceModelBridge: makeOnDeviceModule()},
    });

    expect(bridge.getSnapshotModule()).toBeNull();
  });

  it('returns null when the registered entry is falsy', () => {
    const {bridge} = loadBridge({
      nativeModules: {AssistantSnapshotBridge: undefined},
    });

    expect(bridge.getSnapshotModule()).toBeNull();
  });

  it('reads NativeModules on every call, so late registration is picked up', () => {
    const {bridge, nativeModules} = loadBridge({nativeModules: {}});
    expect(bridge.getSnapshotModule()).toBeNull();

    const snapshot = makeSnapshotModule();
    nativeModules.AssistantSnapshotBridge = snapshot;

    expect(bridge.getSnapshotModule()).toBe(snapshot);
  });
});

describe('getOnDeviceModelModule', () => {
  it('returns null when OnDeviceModelBridge is absent', () => {
    const {bridge} = loadBridge({nativeModules: {}});

    expect(bridge.getOnDeviceModelModule()).toBeNull();
  });

  it('returns the exact OnDeviceModelBridge object when present', () => {
    const model = makeOnDeviceModule();
    const {bridge} = loadBridge({nativeModules: {OnDeviceModelBridge: model}});

    expect(bridge.getOnDeviceModelModule()).toBe(model);
  });

  it('returns a module whose generate() reaches the native implementation', async () => {
    const model = makeOnDeviceModule();
    const {bridge} = loadBridge({nativeModules: {OnDeviceModelBridge: model}});

    await expect(
      bridge.getOnDeviceModelModule()?.generate('hi', 64),
    ).resolves.toBe('hello');
    expect(model.generate).toHaveBeenCalledWith('hi', 64);
  });

  it('does not fall back to the snapshot module', () => {
    const {bridge} = loadBridge({
      nativeModules: {AssistantSnapshotBridge: makeSnapshotModule()},
    });

    expect(bridge.getOnDeviceModelModule()).toBeNull();
  });

  it('returns null when the registered entry is falsy', () => {
    const {bridge} = loadBridge({nativeModules: {OnDeviceModelBridge: null}});

    expect(bridge.getOnDeviceModelModule()).toBeNull();
  });

  it('resolves both modules independently when both are registered', () => {
    const snapshot = makeSnapshotModule();
    const model = makeOnDeviceModule();
    const {bridge} = loadBridge({
      nativeModules: {
        AssistantSnapshotBridge: snapshot,
        OnDeviceModelBridge: model,
      },
    });

    expect(bridge.getSnapshotModule()).toBe(snapshot);
    expect(bridge.getOnDeviceModelModule()).toBe(model);
  });
});

describe('platformProviderLabel', () => {
  it('names Apple Intelligence on iOS', () => {
    const {bridge} = loadBridge({os: 'ios'});

    expect(bridge.platformProviderLabel()).toBe('Apple Intelligence');
  });

  it('names Gemini Nano on Android', () => {
    const {bridge} = loadBridge({os: 'android'});

    expect(bridge.platformProviderLabel()).toBe('Gemini Nano');
  });

  it('falls back to Gemini Nano on any non-iOS platform', () => {
    const {bridge} = loadBridge({os: 'macos'});

    expect(bridge.platformProviderLabel()).toBe('Gemini Nano');
  });

  it('does not depend on which native modules are registered', () => {
    const {bridge} = loadBridge({
      nativeModules: {OnDeviceModelBridge: makeOnDeviceModule()},
      os: 'android',
    });

    expect(bridge.platformProviderLabel()).toBe('Gemini Nano');
  });
});
