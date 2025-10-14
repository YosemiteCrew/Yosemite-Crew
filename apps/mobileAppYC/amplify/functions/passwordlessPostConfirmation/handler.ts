import type { PostConfirmationTriggerHandler } from 'aws-lambda';

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const userId = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const customUserServiceUrl = process.env.CUSTOM_USER_SERVICE_URL;

  if (!userId || !email) {
    console.warn('PostConfirmation triggered without required attributes', {
      userId,
      email,
    });
    return event;
  }

  if (!customUserServiceUrl) {
    console.log('CUSTOM_USER_SERVICE_URL not configured; mocking downstream user creation call.');
    console.log(`Mock payload -> userId: ${userId}, email: ${email}`);
    return event;
  }

  try {
    const response = await fetch(customUserServiceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId, email }),
    });

    if (!response.ok) {
      console.error('Custom user service responded with non-2xx status', {
        status: response.status,
        statusText: response.statusText,
      });
      return event;
    }

    const body = await response
      .json()
      .catch(() => ({ message: 'No JSON body returned by custom service.' }));

    console.log('Custom user service response', body);
  } catch (error) {
    console.error('Error invoking custom user service', error);
  }

  return event;
};
