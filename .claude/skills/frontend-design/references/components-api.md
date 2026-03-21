# Component API Reference

## Button

```tsx
import { Button } from '@/app/ui';

type ButtonVariant = 'primary' | 'secondary' | 'danger';
type ButtonSize = 'default' | 'large';

<Button
  text="Label" // required
  href="#" // required (polymorphic — use "#" for click-only)
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

<Badge label="Active" color="green" />;
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
