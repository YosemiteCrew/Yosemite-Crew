// Example integration: list upcoming appointments, then check API usage.
//
// Setup:
//   1. cp .env.example .env
//   2. Paste an API key from the developer portal (/developers/api-keys)
//      into .env - the example needs the appointments:read scope.
//   3. npm install && npm run dev

import { YosemiteApiError, YosemiteClient } from './client.js';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
  return value;
}

async function main(): Promise<void> {
  const client = new YosemiteClient({
    apiKey: requireEnv('YC_API_KEY'),
    baseUrl: process.env.YC_API_BASE_URL,
  });

  // Upcoming appointments, newest first (scope: appointments:read).
  const appointments = await client.listAppointments({
    status: 'UPCOMING',
    limit: 10,
  });
  console.log(
    `Upcoming appointments (showing ${appointments.data.length}, hasMore=${appointments.pagination.hasMore}):`
  );
  for (const appointment of appointments.data) {
    const patientName = appointment.patient?.name ?? 'unknown patient';
    const time = appointment.timeSlot ?? appointment.startTime ?? '';
    console.log(
      `  - ${appointment.appointmentDate} ${time} ${patientName} (${appointment.status})`
    );
  }
  if (appointments.pagination.hasMore && appointments.pagination.nextCursor) {
    console.log(
      `  ...more available - pass cursor=${appointments.pagination.nextCursor} to fetch the next page.`
    );
  }

  // Usage needs no scope and never counts against your quota.
  const usage = await client.getUsage();
  const limit = usage.limit === null ? 'unlimited' : String(usage.limit);
  console.log('');
  console.log(`API usage for ${usage.billingPeriod}: ${usage.callCount} of ${limit} calls.`);
}

main().catch((error: unknown) => {
  if (error instanceof YosemiteApiError) {
    if (error.code === 'quota_exceeded') {
      console.error(
        `Monthly quota exhausted (resets in ${error.retryAfterSeconds ?? '?'}s): ${error.message}`
      );
    } else if (error.code === 'rate_limited') {
      console.error(`Rate limited - retry in ${error.retryAfterSeconds ?? 1}s: ${error.message}`);
    } else {
      console.error(`API error ${error.status} (${error.code}): ${error.message}`);
    }
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
