import React from 'react';
import InfoBottomSheet, {type InfoBottomSheetRef} from './InfoBottomSheet';

export const CanceledInfoSheet = ({
  onClose,
  ref,
}: {onClose?: () => void} & {ref?: React.Ref<InfoBottomSheetRef>}) => (
  <InfoBottomSheet
    ref={ref}
    title="Appointment canceled"
    message="We will notify you once the organisation accepts your request."
    cta="Close"
    onCta={onClose}
  />
);

export default CanceledInfoSheet;
