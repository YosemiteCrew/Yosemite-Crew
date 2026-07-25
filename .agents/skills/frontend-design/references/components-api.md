# Component API Reference

## Button

```tsx
import { Button } from '@/app/ui';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'default' | 'large';

<Button
  text="Label" // required
  href="/path" // optional — when set, renders a Next.js Link (<a>). OMIT for click/submit/reset actions so it stays a real <button>.
  variant="primary" // optional, default: primary
  size="default" // optional, default: default
  onClick={handler} // optional
  isDisabled={false} // optional
  className="..." // optional extra classes
  style={{}} // optional inline style (avoid)
/>;
```

## Card

```tsx
import { Card } from '@/app/ui';

type CardVariant = 'default' | 'bordered' | 'subtle';

<Card variant="default" className="...">
  {children}
</Card>;
```

## Badge

```tsx
import { Badge } from '@/app/ui';

// Non-status labels only - for status chips use StatusPill below.
<Badge tone="success">Active</Badge>; // tone: neutral | brand | success | warning | danger (default neutral); content via children
```

## StatusPill

The one status pill for the whole app (shared geometry: 10px/700 uppercase, full-radius bordered pill). Default export, imported by path - it is not in the `@/app/ui` barrel.

```tsx
import StatusPill from '@/app/ui/primitives/StatusPill/StatusPill';

<StatusPill
  label="Active" // required, ReactNode; rendered uppercase
  tone="success" // optional: success | warning | danger | info | neutral | accent | progress (default neutral)
  tokens={{ bg: '...', text: '...', border: '...' }} // optional explicit colour set; wins over tone
  style={getStatusStyle(status)} // optional colour passthrough ({color, backgroundColor, borderColor}); wins over tone/tokens
  showDot // optional leading live-dot (default false)
  className="w-fit" // optional, layout classes only
/>;
```

## SegmentedPill

Segmented pill control (view/tab toggles). Default export, imported by path.

```tsx
import SegmentedPill from '@/app/ui/primitives/SegmentedPill/SegmentedPill';

<SegmentedPill
  options={[
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
  ]} // required: ReadonlyArray<{ value; label }>
  value={view} // required, current value
  onChange={setView} // required
  ariaLabel="Calendar view" // required
  size="md" // optional: sm | md | lg (default sm)
  fullWidth // optional: equal-width segments stretched to the container (default false)
  disabled={false} // optional
/>;
```

## Stack

```tsx
import { Stack } from '@/app/ui';

<Stack direction="row" gap={2} align="center">
  {children}
</Stack>;
```

## Text

```tsx
import { Text } from '@/app/ui';

<Text variant="body" className="...">
  Content
</Text>;
```

## Input

```tsx
import { Input } from '@/app/ui';

<Input value={value} onChange={handler} placeholder="..." className="..." />;
```
