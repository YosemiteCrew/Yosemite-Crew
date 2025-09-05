import React, {useState, useCallback} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import {GOOGLE_API_KEY, SHA_1} from '../../constants';
import Input from '../Input';
import {scaledValue} from '../../utils/design.utils';
import GText from '../GText/GText';

// Debounce utility
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func(...args);
    }, delay);
  };
};

const GooglePlacesInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  onSelect, // will return place details
  apiKey = GOOGLE_API_KEY,
  containerStyle,
  inputStyle,
  resultLimit = 5,
}) => {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const androidHeader = {
    'X-Android-Package': 'com.yosemite.crew',
    'X-Android-Cert': SHA_1,
  };
  const iosHeader = {
    'x-ios-bundle-identifier': 'com.yosemite.crew',
  };

  // Fetch Google places suggestions
  const fetchPlaces = async text => {
    if (!text) {
      setResults([]);
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${text}&key=${apiKey}`,
        {
          headers: Platform.OS === 'android' ? androidHeader : iosHeader,
        },
      );
      const data = await response.json();
      console.log('datadatadata', JSON.stringify(data));

      if (data.status === 'OK') {
        setResults(data.predictions);
      } else {
        setResults([]);
        console.log('Google API Error:', data.status);
      }
    } catch (err) {
      console.log('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch details for a selected place
  const getPlaceDetails = async placeId => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}`,
        {
          headers: Platform.OS === 'android' ? androidHeader : iosHeader,
        },
      );
      const json = await response.json();

      if (json.result) {
        const components = json.result.address_components;

        const getComponent = type =>
          components.find(c => c.types.includes(type))?.long_name || '';

        const details = {
          city: getComponent('locality'),
          state: getComponent('administrative_area_level_1'),
          postal_code: getComponent('postal_code'),
          area: getComponent('sublocality'),
          full_address: json.result.formatted_address,
          location: json.result.geometry?.location, // {lat, lng}
          country: getComponent('country'),
        };

        // return details via onSelect
        onSelect?.(details, json.result);
      }
    } catch (err) {
      console.error('Place details error:', err);
    }
  };

  const debouncedSearch = useCallback(debounce(fetchPlaces, 500), []);

  const handleChange = text => {
    setQuery(text);
    onChangeText?.(text); // external change handler
    debouncedSearch(text);
  };

  const handleSelect = item => {
    setQuery(item.description);
    setResults([]);
    getPlaceDetails(item.place_id);
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Input
        style={[styles.input, inputStyle]}
        value={query}
        label={label}
        placeholder={placeholder || 'Search address'}
        onChangeText={handleChange}
      />

      {loading && <ActivityIndicator style={{marginTop: scaledValue(8)}} />}

      {results?.length > 0 && (
        <FlatList
          data={results.slice(0, resultLimit)}
          keyExtractor={item => item.place_id}
          renderItem={({item}) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              style={styles.resultItem}>
              <GText
                text={item.description}
                style={{fontSize: scaledValue(15)}}
                componentProps={{
                  numberOfLines: 1,
                  ellipsizeMode: 'tail',
                }}
              />
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
};

export default GooglePlacesInput;

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  input: {
    width: '100%',
    backgroundColor: 'transparent',
    paddingLeft: scaledValue(10),
  },
  resultItem: {
    paddingVertical: scaledValue(10),
  },
});
