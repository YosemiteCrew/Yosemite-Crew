<div align="center">
  <h1>React Native Liquid Glass 🔍</h1>

[![mit licence](https://img.shields.io/dub/l/vibe-d.svg?style=for-the-badge)](https://github.com/callstack/liquid-glass/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@callstack/liquid-glass?style=for-the-badge)](https://www.npmjs.org/package/@callstack/liquid-glass)
[![npm downloads](https://img.shields.io/npm/dt/@callstack/liquid-glass.svg?style=for-the-badge)](https://www.npmjs.org/package/@callstack/liquid-glass)
[![npm downloads](https://img.shields.io/npm/dm/@callstack/liquid-glass.svg?style=for-the-badge)](https://www.npmjs.org/package/@callstack/liquid-glass)

`@callstack/liquid-glass` brings iOS 26 liquid glass effect to React Native apps on iOS.

https://github.com/user-attachments/assets/44c18136-8760-49f2-ae16-62557c3ae2e1

</div>

## Features

- ✨ iOS 26 liquid glass visual effect
- 🎨 Customizable tint colors
- 🔧 Two effect modes: `clear` and `regular`

## Documentation

### Installation

```bash
npm install @callstack/liquid-glass
# or
yarn add @callstack/liquid-glass
```

> [!WARNING]
> Make sure to compile your app with Xcode >= 26. React Native 0.80+ is required.

> [!WARNING]
> This library is not supported in [Expo Go](https://expo.dev/go).



### Usage

```tsx
import {
  LiquidGlassView,
  LiquidGlassContainerView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';

function MyComponent() {
  return (
    <LiquidGlassView
      style={[
        { width: 200, height: 100, borderRadius: 20 },
        !isLiquidGlassSupported && { backgroundColor: 'rgba(255,255,255,0.5)' },
      ]}
      interactive
      effect="clear"
    >
      <Text>Hello World</Text>
    </LiquidGlassView>
  );
}

// For combining multiple glass elements
function MergingGlassElements() {
  return (
    <LiquidGlassContainerView spacing={20}>
      <LiquidGlassView style={{ width: 100, height: 100, borderRadius: 50 }} />
      <LiquidGlassView style={{ width: 100, height: 100, borderRadius: 50 }} />
    </LiquidGlassContainerView>
  );
}
```

To achieve automatic text color adaptation based on the background behind the glass view, use `PlatformColor` from `react-native`:

> [!NOTE]
> There appears to be a size limit for the glass to automatically adapt the text color. If the glass view height is >= 65 it won't automatically adapt to the material behind it.

https://github.com/user-attachments/assets/199bce70-dab4-43bc-9de1-605f561760e5

```tsx
import { PlatformColor } from 'react-native';
import { LiquidGlassView } from '@callstack/liquid-glass';

function MyComponent() {
  return (
    <LiquidGlassView style={{ padding: 20, borderRadius: 20 }}>
      <Text style={{ color: PlatformColor('labelColor') }}>Hello World</Text>
    </LiquidGlassView>
  );
}
```

> [!NOTE]
> On unsupported iOS version (below iOS 26), it will render a normal `View` without any effects.

### API

#### `isLiquidGlassSupported`

A boolean constant that indicates whether the current device supports the liquid glass effect.

```tsx
import { isLiquidGlassSupported } from '@callstack/liquid-glass';

if (isLiquidGlassSupported) {
  // Device supports liquid glass effect
} else {
  // Provide fallback UI
}
```

### LiquidGlassView - Props

| Prop          | Type                            | Default     | Description                                                                                                                         |
| ------------- | ------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `interactive` | `boolean`                       | `false`     | Enables touch interaction effects when pressing the view                                                                            |
| `effect`      | `'clear' \| 'regular' \| 'none'` | `'regular'` | Visual effect mode:<br/>• `clear` - More transparent glass effect<br/>• `regular` - Standard glass blur effect<br/>• `none` - No glass effect (transparent view)<br/>**Note:** Changing this property animates the materialization/dematerialization of the glass effect |
| `tintColor`   | `ColorValue`                    | `undefined` | Overlay color tint applied to the glass effect. Accepts any React Native color format (hex, rgba, named colors)                     |
| `colorScheme` | `'light' \| 'dark' \| 'system'` | `'system'`  | Color scheme adaptation:<br/>• `light` - Light appearance<br/>• `dark` - Dark appearance<br/>• `system` - Follows system appearance |

### LiquidGlassContainerView - Props

| Prop      | Type     | Default | Description                                                                                                 |
| --------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| `spacing` | `number` | `0`     | The distance between child elements at which they begin to merge their glass effects into a combined effect |

## Known issues

- `interactive` prop is not changed dynamically, it is only set on mount.

## Made with ❤️ at Callstack

`liquid-glass` is an open source project and will always remain free to use. If you think it's cool, please star it 🌟.

[Callstack][callstack-readme-with-love] is a group of React and React Native geeks, contact us at [hello@callstack.com](mailto:hello@callstack.com) if you need any help with these or just want to say hi!

Like the project? ⚛️ [Join the team](https://callstack.com/careers/?utm_campaign=Senior_RN&utm_source=github&utm_medium=readme) who does amazing stuff for clients and drives React Native Open Source! 🔥

[callstack-readme-with-love]: https://callstack.com/?utm_source=github.com&utm_medium=referral&utm_campaign=liquid-glass&utm_term=readme-with-love
[version-badge]: https://img.shields.io/npm/v/@callstack/liquid-glass?style=for-the-badge
[version]: https://github.com/callstack/liquid-glass/blob/main/LICENSE
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: ./CONTRIBUTING.md