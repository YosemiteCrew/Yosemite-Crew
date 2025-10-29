import React, {forwardRef} from 'react';
import InfoBottomSheet, {type InfoBottomSheetRef} from './InfoBottomSheet';

export const BookedInfoSheet = forwardRef<InfoBottomSheetRef, {onClose?: () => void}>(
  ({onClose}, ref) => (
    <InfoBottomSheet
      ref={ref}
      title="Appointment booked"
      message="We will notify you once the organisation accepts your request."
      cta="Close"
      onCta={onClose}
    />
  ),
);

export default BookedInfoSheet;

