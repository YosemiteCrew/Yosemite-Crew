import React, {useMemo} from 'react';
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';
import {Input} from '@/shared/components/common/Input/Input';
import {useTheme} from '@/hooks';
import type {PlaceSuggestion} from '@/shared/services/maps/googlePlaces';

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
}) => {
  const {theme} = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const shouldShowSuggestionList =
    isFetchingSuggestions || addressSuggestions.length > 0 || !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      <View style={styles.inputGroup}>
        <Input
          label="Address"
          value={values.addressLine ?? ''}
          onChangeText={value => onChange('addressLine', value)}
          error={fieldErrors?.addressLine ?? error ?? undefined}
          multiline
          maxLength={200}
          containerStyle={styles.addressInput}
        />

        {shouldShowSuggestionList ? (() => {
          let content: React.ReactNode;
          if (isFetchingSuggestions) {
            content = (
              <View style={styles.suggestionLoader}>
                <ActivityIndicator size="small" color={theme.colors.primary} />
              </View>
            );
          } else if (addressSuggestions.length > 0) {
            content = (
              <View style={styles.suggestionList}>
                {addressSuggestions.map((item, index) => (
                  <TouchableOpacity
                    key={item.placeId}
                    style={[
                      styles.suggestionItem,
                      index === addressSuggestions.length - 1 && styles.suggestionItemLast,
                    ]}
                    onPress={() => onSelectSuggestion(item)}>
                    <Text style={styles.suggestionPrimary}>{item.primaryText}</Text>
                    {item.secondaryText ? (
                      <Text style={styles.suggestionSecondary}>{item.secondaryText}</Text>
                    ) : null}
                  </TouchableOpacity>
                ))}
              </View>
            );
          } else {
            content = (
              <Text style={styles.suggestionEmpty}>
                {error ?? 'No suggestions found.'}
              </Text>
            );
          }

          return (
            <View style={styles.suggestionContainer}>
              <Text style={styles.suggestionTitle}>Suggestions</Text>
              {content}
              {isFetchingSuggestions || addressSuggestions.length > 0 ? (
                <Text style={styles.suggestionFooter}>Powered by Google</Text>
              ) : null}
            </View>
          );
        })() : null}
      </View>

      <Input
        label={Platform.select({ios: 'State', default: 'State/Province'}) ?? 'State/Province'}
        value={values.stateProvince ?? ''}
        onChangeText={value => onChange('stateProvince', value)}
        error={fieldErrors?.stateProvince}
        containerStyle={styles.singleInput}
      />

      <View style={styles.inlineRow}>
        <Input
          label="City"
          value={values.city ?? ''}
          onChangeText={value => onChange('city', value)}
          error={fieldErrors?.city}
          containerStyle={styles.inlineInput}
        />
        <Input
          label="Postal code"
          value={values.postalCode ?? ''}
          onChangeText={value => onChange('postalCode', value)}
          error={fieldErrors?.postalCode}
          containerStyle={styles.inlineInput}
        />
      </View>

      <Input
        label="Country"
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
      ...theme.typography.labelXsBold,
      color: theme.colors.secondary,
    },
    suggestionLoader: {
      alignItems: 'center',
      paddingVertical: theme.spacing['3'],
    },
    suggestionList: {
      maxHeight: 200,
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
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
    },
    suggestionEmpty: {
      ...theme.typography.labelXsBold,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      paddingVertical: theme.spacing['3'],
    },
    suggestionItemLast: {
      borderBottomWidth: 0,
    },
    suggestionFooter: {
      ...theme.typography.labelXsBold,
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
