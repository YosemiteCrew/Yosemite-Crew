import {createEmptyGateScreenStyles} from '../../src/shared/styles/emptyGateScreenStyles';
import {mockTheme} from '../setup/mockTheme';

describe('createEmptyGateScreenStyles', () => {
  it('returns a screen-colored safe area and a centered container', () => {
    const styles = createEmptyGateScreenStyles(mockTheme as any);

    expect(styles.safeArea).toEqual({
      flex: 1,
      backgroundColor: mockTheme.colors.screen,
    });

    expect(styles.container).toEqual({
      flex: 1,
      backgroundColor: mockTheme.colors.screen,
      alignItems: 'center',
      justifyContent: 'center',
    });
  });
});
