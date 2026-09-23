import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

import Field from '@/app/ui/Field';
import Input from '@/app/ui/Input';

expect.extend(toHaveNoViolations);

describe('Field', () => {
  test('binds its label and exposes required and disabled states', () => {
    render(
      <Field htmlFor="email" label="Work email" disabled>
        <Input id="email" placeholder="name@clinic.com" required disabled />
      </Field>
    );

    const input = screen.getByLabelText('Work email');
    expect(input).toBeRequired();
    expect(input).toBeDisabled();
  });

  test('shows the hint when valid and the error instead when invalid', () => {
    const { rerender } = render(
      <Field htmlFor="room" label="Room" hint="Use the room name." messageId="room-message">
        <Input id="room" aria-describedby="room-message" placeholder="Enter a room" />
      </Field>
    );

    expect(screen.getByText('Use the room name.')).toHaveAttribute('id', 'room-message');

    rerender(
      <Field
        htmlFor="room"
        label="Room"
        hint="Use the room name."
        error="Room is required."
        messageId="room-message"
      >
        <Input id="room" aria-describedby="room-message" error placeholder="Enter a room" />
      </Field>
    );

    expect(screen.queryByText('Use the room name.')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Room is required.');
  });

  test('has no accessibility violations', async () => {
    const { container } = render(
      <Field
        htmlFor="email"
        label="Work email"
        hint="Used for reminders."
        messageId="email-message"
      >
        <Input id="email" aria-describedby="email-message" placeholder="name@clinic.com" />
      </Field>
    );

    expect(await axe(container)).toHaveNoViolations();
  });
});
