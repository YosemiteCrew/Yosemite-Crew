describe('Mobile smoke', () => {
  beforeAll(async () => {
    await device.launchApp({newInstance: true});
  });

  it('shows app shell', async () => {
    await expect(element(by.type('RCTRootView'))).toBeVisible();
  });
});
