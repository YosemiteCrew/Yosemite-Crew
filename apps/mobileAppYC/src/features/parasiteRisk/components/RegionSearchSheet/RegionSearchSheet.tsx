import React, {useCallback, useEffect, useReducer, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Modal,
} from 'react-native';
import {useTranslation} from 'react-i18next';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {SafeAreaView} from 'react-native-safe-area-context';
import {snapToRiskCell} from '@yosemite-crew/types';
import {PressableOpacity} from '@/shared/components/common/PressableOpacity/PressableOpacity';
import {useTheme} from '@/hooks';
import {fonts} from '@/theme/typography';
import {
  fetchPlaceDetails,
  fetchPlaceSuggestions,
  REGION_PRIMARY_TYPES,
  type PlaceSuggestion,
} from '@/shared/services/maps/googlePlaces';
import LocationService from '@/shared/services/LocationService';
import type {RiskLocation} from '../../types';

interface RegionSearchSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (location: RiskLocation) => void;
  recentLocations: readonly RiskLocation[];
}

const SEARCH_DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

interface RegionSearchState {
  query: string;
  suggestions: PlaceSuggestion[];
  searching: boolean;
  resolving: boolean;
  errorKey: string | null;
}

const INITIAL_SEARCH_STATE: RegionSearchState = {
  query: '',
  suggestions: [],
  searching: false,
  resolving: false,
  errorKey: null,
};

const mergeSearchState = (
  state: RegionSearchState,
  update: Partial<RegionSearchState>,
): RegionSearchState => ({...state, ...update});

/**
 * Place search for the risk forecast.
 *
 * Reuses the app's existing Places wrapper rather than adding a second
 * geocoder. Only the resolved coordinate is used, and the screen snaps it to a
 * grid cell before it reaches the API.
 */
const RegionSearchSheetContent: React.FC<
  Omit<RegionSearchSheetProps, 'visible'>
> = ({onClose, onSelect, recentLocations}) => {
  const {theme} = useTheme();
  const {t} = useTranslation();
  const [{query, suggestions, searching, resolving, errorKey}, updateSearch] =
    useReducer(mergeSearchState, INITIAL_SEARCH_STATE);
  const detailRequestId = useRef(0);

  const reset = useCallback(() => {
    detailRequestId.current += 1;
    updateSearch(INITIAL_SEARCH_STATE);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [onClose, reset]);

  useEffect(() => {
    if (query.trim().length < MIN_QUERY_LENGTH) {
      // Shortening the query cancels the in-flight search, whose `finally` is
      // then skipped, so the spinner has to be cleared here too.
      updateSearch({suggestions: [], searching: false});
      return;
    }

    let cancelled = false;
    updateSearch({searching: true, errorKey: null, suggestions: []});

    const timer = setTimeout(() => {
      // Region-level types, not the wrapper's street-level default: this sheet
      // searches by suburb, town or postcode.
      fetchPlaceSuggestions({query, includedPrimaryTypes: REGION_PRIMARY_TYPES})
        .then(results => {
          if (!cancelled) updateSearch({suggestions: results});
        })
        .catch(() => {
          if (!cancelled) {
            updateSearch({
              suggestions: [],
              errorKey: 'parasiteRisk.search.error',
            });
          }
        })
        .finally(() => {
          if (!cancelled) updateSearch({searching: false});
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleSuggestion = useCallback(
    async (suggestion: PlaceSuggestion) => {
      const requestId = ++detailRequestId.current;
      updateSearch({resolving: true, errorKey: null});

      try {
        const details = await fetchPlaceDetails(suggestion.placeId);
        if (requestId !== detailRequestId.current) return;

        if (
          details?.latitude === undefined ||
          details?.longitude === undefined
        ) {
          updateSearch({errorKey: 'parasiteRisk.search.unresolved'});
          return;
        }

        onSelect({
          label: details.city ?? suggestion.primaryText,
          lat: details.latitude,
          lon: details.longitude,
          countryCode: details.countryCode,
        });
        handleClose();
      } catch {
        if (requestId === detailRequestId.current) {
          updateSearch({errorKey: 'parasiteRisk.search.error'});
        }
      } finally {
        if (requestId === detailRequestId.current) {
          updateSearch({resolving: false});
        }
      }
    },
    [handleClose, onSelect],
  );

  const handleUseCurrentLocation = useCallback(async () => {
    const requestId = ++detailRequestId.current;
    updateSearch({resolving: true, errorKey: null});

    try {
      const coords = await LocationService.getCurrentPosition();
      if (requestId !== detailRequestId.current) return;
      // Snapped here rather than at the API boundary: the chosen location is
      // persisted to AsyncStorage, and the precise device fix must not be. The
      // forecast is per cell anyway, so nothing is lost by rounding early.
      const cell = snapToRiskCell(coords.latitude, coords.longitude);

      // No country code here: there is no reverse geocoder on this path, and
      // the API resolves the region from the coordinate instead.
      onSelect({
        label: t('parasiteRisk.search.currentLocation'),
        lat: cell.lat,
        lon: cell.lon,
      });
      handleClose();
    } catch (error) {
      if (requestId === detailRequestId.current) {
        const denied =
          error instanceof Error &&
          /permission|denied|blocked/i.test(error.message);
        updateSearch({
          errorKey: denied
            ? 'parasiteRisk.search.locationDenied'
            : 'parasiteRisk.search.locationUnavailable',
        });
      }
    } finally {
      if (requestId === detailRequestId.current) {
        updateSearch({resolving: false});
      }
    }
  }, [handleClose, onSelect, t]);

  const renderSuggestion = useCallback(
    ({item}: {item: PlaceSuggestion}) => (
      <PressableOpacity
        onPress={() => handleSuggestion(item)}
        accessibilityRole="button"
        style={[styles.row, {borderBottomColor: theme.colors.borderSeparator}]}>
        <Ionicons
          name="location-outline"
          size={18}
          color={theme.colors.placeholder}
        />
        <View style={styles.rowBody}>
          <Text style={[styles.rowText, {color: theme.colors.ink}]}>
            {item.primaryText}
          </Text>
          {item.secondaryText ? (
            <Text
              style={[styles.rowSubtext, {color: theme.colors.inkMuted}]}
              numberOfLines={1}>
              {item.secondaryText}
            </Text>
          ) : null}
        </View>
      </PressableOpacity>
    ),
    [handleSuggestion, theme.colors],
  );

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}>
      <SafeAreaView
        style={[styles.container, {backgroundColor: theme.colors.page}]}
        edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={[styles.title, {color: theme.colors.ink}]}>
            {t('parasiteRisk.search.title')}
          </Text>
          <PressableOpacity
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}>
            <Ionicons name="close" size={24} color={theme.colors.ink} />
          </PressableOpacity>
        </View>

        <View
          style={[
            styles.searchRow,
            {
              backgroundColor: theme.colors.fieldBg,
              borderColor: theme.colors.hairline,
            },
          ]}>
          <Ionicons name="search" size={18} color={theme.colors.placeholder} />
          <TextInput
            value={query}
            onChangeText={value => updateSearch({query: value})}
            placeholder={t('parasiteRisk.search.placeholder')}
            placeholderTextColor={theme.colors.placeholder}
            style={[styles.input, {color: theme.colors.ink}]}
            autoFocus
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" /> : null}
        </View>

        <PressableOpacity
          onPress={handleUseCurrentLocation}
          accessibilityRole="button"
          style={styles.currentLocationRow}>
          <Ionicons name="locate" size={18} color={theme.colors.blue} />
          <Text style={[styles.currentLocation, {color: theme.colors.blue}]}>
            {t('parasiteRisk.search.useCurrentLocation')}
          </Text>
        </PressableOpacity>

        {errorKey ? (
          <Text style={[styles.error, {color: theme.colors.danger}]}>
            {t(errorKey)}
          </Text>
        ) : null}

        {resolving ? <ActivityIndicator style={styles.resolving} /> : null}

        <FlatList
          data={suggestions}
          keyExtractor={item => item.placeId}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            suggestions.length === 0 && recentLocations.length > 0 ? (
              <Text
                style={[styles.sectionLabel, {color: theme.colors.inkMuted}]}>
                {t('parasiteRisk.search.recent')}
              </Text>
            ) : null
          }
          ListEmptyComponent={
            <View>
              {recentLocations.map(location => (
                <PressableOpacity
                  key={`${location.label}-${location.lat}-${location.lon}`}
                  onPress={() => {
                    onSelect(location);
                    onClose();
                  }}
                  accessibilityRole="button"
                  style={[
                    styles.row,
                    {borderBottomColor: theme.colors.borderSeparator},
                  ]}>
                  <Ionicons
                    name="time-outline"
                    size={18}
                    color={theme.colors.placeholder}
                  />
                  <Text style={[styles.rowText, {color: theme.colors.ink}]}>
                    {location.label}
                  </Text>
                </PressableOpacity>
              ))}
            </View>
          }
          renderItem={renderSuggestion}
        />
      </SafeAreaView>
    </Modal>
  );
};

export const RegionSearchSheet: React.FC<RegionSearchSheetProps> = ({
  visible,
  ...props
}) => (visible ? <RegionSearchSheetContent {...props} /> : null);

const styles = StyleSheet.create({
  container: {flex: 1, paddingHorizontal: 20},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  title: {
    fontFamily: fonts.NEWSREADER_REGULAR,
    fontSize: 24,
    lineHeight: 30,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 15,
    padding: 0,
  },
  currentLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  currentLocation: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 14,
  },
  error: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 13,
    marginBottom: 8,
  },
  resolving: {marginVertical: 12},
  sectionLabel: {
    fontFamily: fonts.SATOSHI_BOLD,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {flex: 1},
  rowText: {
    fontFamily: fonts.SATOSHI_MEDIUM,
    fontSize: 15,
    lineHeight: 20,
  },
  rowSubtext: {
    fontFamily: fonts.SATOSHI_REGULAR,
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
});
