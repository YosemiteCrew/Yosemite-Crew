import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {Input} from '@/shared/components/common/Input/Input';
import {useTheme} from '@/hooks';
import type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';

const MAX_VISIBLE_ADDRESS_SUGGESTIONS = 5;

export interface AddressFieldValues {
  addressLine?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}

interface AddressFieldsProps {
  values: AddressFieldValues;
  onChange: (field: keyof AddressFieldValues, value: string) => void;
  addressSuggestions: PlaceSuggestion[];
  isFetchingSuggestions: boolean;
  error?: string | null;
  onSelectSuggestion: (suggestion: PlaceSuggestion) => void;
  fieldErrors?: Partial<Record<keyof AddressFieldValues, string | undefined>>;
  containerStyle?: StyleProp<ViewStyle>;
  labels?: Partial<
    Record<
      'addressLine' | 'city' | 'stateProvince' | 'postalCode' | 'country',
      string
    >
  >;
}

export const AddressFields: React.FC<AddressFieldsProps> = ({
  values,
  onChange,
  addressSuggestions,
  isFetchingSuggestions,
  error,
  onSelectSuggestion,
  fieldErrors,
  containerStyle,
  labels,
}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const resolvedLabels = {
    addressLine: labels?.addressLine ?? t('addressFields.addressLine'),
    stateProvince:
      labels?.stateProvince ??
      Platform.select({
        ios: t('addressFields.state'),
        default: t('addressFields.stateProvince'),
      }) ??
      t('addressFields.stateProvince'),
    city: labels?.city ?? t('addressFields.city'),
    postalCode: labels?.postalCode ?? t('addressFields.postalCode'),
    country: labels?.country ?? t('addressFields.country'),
  };

  const shouldShowSuggestionList =
    isFetchingSuggestions || addressSuggestions.length > 0 || !!error;
  const visibleAddressSuggestions = useMemo(
    () => addressSuggestions.slice(0, MAX_VISIBLE_ADDRESS_SUGGESTIONS),
    [addressSuggestions],
  );
  const hasMoreSuggestions =
    addressSuggestions.length > MAX_VISIBLE_ADDRESS_SUGGESTIONS;
  const suggestionTitleText = hasMoreSuggestions
    ? t('addressFields.topSuggestionsTitle', {
        count: MAX_VISIBLE_ADDRESS_SUGGESTIONS,
        total: addressSuggestions.length,
      })
    : t('addressFields.suggestionsTitle');

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputGroup}>
        <Input
          label={resolvedLabels.addressLine}
          value={values.addressLine ?? ''}
          onChangeText={value => onChange('addressLine', value)}
          error={fieldErrors?.addressLine ?? error ?? undefined}
          multiline
          maxLength={200}
          containerStyle={styles.addressInput}
        />

        {shouldShowSuggestionList
          ? (() => {
              let content: React.ReactNode;
              if (isFetchingSuggestions) {
                content = (
                  <View style={styles.suggestionLoader}>
                    <ActivityIndicator
                      size="small"
                      color={theme.colors.primary}
                    />
                  </View>
                );
              } else if (addressSuggestions.length > 0) {
                content = (
                  <View style={styles.suggestionList}>
                    {visibleAddressSuggestions.map((item, index) => (
                      <PressableOpacity
                        key={item.placeId}
                        style={[
                          styles.suggestionItem,
                          index === visibleAddressSuggestions.length - 1 &&
                            styles.suggestionItemLast,
                        ]}
                        onPress={() => onSelectSuggestion(item)}
                        accessibilityRole="button"
                        accessibilityLabel={
                          item.secondaryText
                            ? `${item.primaryText}, ${item.secondaryText}`
                            : item.primaryText
                        }>
                        <Text style={styles.suggestionPrimary}>
                          {item.primaryText}
                        </Text>
                        {item.secondaryText ? (
                          <Text style={styles.suggestionSecondary}>
                            {item.secondaryText}
                          </Text>
                        ) : null}
                      </PressableOpacity>
                    ))}
                  </View>
                );
              } else {
                content = (
                  <Text style={styles.suggestionEmpty}>
                    {error ?? t('addressFields.noSuggestionsFound')}
                  </Text>
                );
              }

              return (
                <View style={styles.suggestionContainer}>
                  <Text style={styles.suggestionTitle}>
                    {suggestionTitleText}
                  </Text>
                  {content}
                  {isFetchingSuggestions || addressSuggestions.length > 0 ? (
                    <Text style={styles.suggestionFooter}>
                      {t('addressFields.poweredByGoogle')}
                    </Text>
                  ) : null}
                </View>
              );
            })()
          : null}
      </View>

      <Input
        label={resolvedLabels.stateProvince}
        value={values.stateProvince ?? ''}
        onChangeText={value => onChange('stateProvince', value)}
        error={fieldErrors?.stateProvince}
        containerStyle={styles.singleInput}
      />

      <View style={styles.inlineRow}>
        <Input
          label={resolvedLabels.city}
          value={values.city ?? ''}
          onChangeText={value => onChange('city', value)}
          error={fieldErrors?.city}
          containerStyle={styles.inlineInput}
        />
        <Input
          label={resolvedLabels.postalCode}
          value={values.postalCode ?? ''}
          onChangeText={value => onChange('postalCode', value)}
          error={fieldErrors?.postalCode}
          containerStyle={styles.inlineInput}
        />
      </View>

      <Input
        label={resolvedLabels.country}
        value={values.country ?? ''}
        onChangeText={value => onChange('country', value)}
        error={fieldErrors?.country}
        containerStyle={styles.singleInput}
      />
    </View>
  );
};

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: {
      gap: theme.spacing['4'],
      paddingTop: theme.spacing['3'],
    },
    inputGroup: {
      gap: theme.spacing['2'],
    },
    addressInput: {
      marginBottom: 0,
    },
    suggestionContainer: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.borderRadius.lg,
      backgroundColor: theme.colors.surface,
      padding: theme.spacing['3'],
      gap: theme.spacing['2'],
    },
    suggestionTitle: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.secondary,
    },
    suggestionLoader: {
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
    },
    suggestionList: {
      maxHeight: 200,
      flex: 0,
    },
    suggestionItem: {
      paddingVertical: theme.spacing['2'],
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    suggestionPrimary: {
      ...theme.typography.bodyBold,
      color: theme.colors.secondary,
    },
    suggestionSecondary: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
    },
    suggestionEmpty: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.spacing['3'],
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionFooter: {
      ...theme.typography.labelXxsBold,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      paddingTop: theme.spacing['2'],
    },
    inlineRow: {
      flexDirection: 'row',
      gap: theme.spacing['3'],
    },
    inlineInput: {
      flex: 1,
    },
    singleInput: {
      marginBottom: 0,
    },
  });

export default AddressFields;
