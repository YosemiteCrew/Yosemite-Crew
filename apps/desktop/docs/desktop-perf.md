# Desktop Performance

## Cold Start + Idle RSS

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
