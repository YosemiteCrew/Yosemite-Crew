let resolvedKey = '';

export const setResolvedStripePublishableKey = (key: string): void => {
  resolvedKey = key;
};

export const getResolvedStripePublishableKey = (): string => resolvedKey;
