# Desktop Performance

This note records the desktop shell's startup and memory baselines and the command used to reproduce them, so contributors can spot regressions after a change. It is a local smoke reference, not a certified benchmark. See [`desktop-architecture.md`](desktop-architecture.md) for how the process model shapes these numbers.

## Cold Start + Idle RSS

RSS (Resident Set Size) is the amount of physical memory the app process is holding while idle.

Measurement command:

```sh
pnpm --filter @yosemite-crew/desktop run desktop:pack
node apps/desktop/scripts/measure-startup.js
```

Local sample captured on macOS arm64 from the unpacked packaged app:

```json
{
  "startupMs": 5003,
  "idleRssMb": 150.6
}
```

Use this as a smoke baseline only. Release candidates should be measured on a clean Mac and Windows machine after signed installer builds are produced.
