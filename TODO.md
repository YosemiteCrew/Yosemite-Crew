# EditParentScreen Implementation Plan

## Tasks
- [x] Create CurrencyBottomSheet.tsx: Similar to CountryMobileBottomSheet, using getSupportedCurrencies from react-native-format-currency, with flags from countryList.json.
- [x] Create AddressBottomSheet.tsx: With inputs for addressLine, city, stateProvince, postalCode, country; autocomplete on addressLine using Google Places (fetchPlaceSuggestions, fetchPlaceDetails) like in CreateAccountScreen. One input per row.
- [x] Create EditParentScreen.tsx: Copy CompanionOverviewScreen structure, adapt to parent data from selectAuthUser, use InlineEditRow for text fields (firstName, lastName), RowButton for phone (CountryMobileBottomSheet), currency, and multiple address fields (all opening AddressBottomSheet), integrate ProfileImagePicker, save changes via updateUserProfile. Handle date of birth like in CompanionOverviewScreen. Remove name/email from header, decrease profile image size, wrap long address text.

## Testing
- [ ] Test bottom sheets open correctly.
- [ ] Test edits save via updateUserProfile.
- [ ] Test autocomplete works in AddressBottomSheet.
