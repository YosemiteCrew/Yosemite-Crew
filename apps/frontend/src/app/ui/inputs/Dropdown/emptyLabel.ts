/**
 * Text a select shows while nothing is chosen.
 *
 * The design makes a placeholder mandatory on every select ("Speciality" above,
 * "Select a speciality" inside); shipped triggers rendered an empty box instead,
 * so a required field looked identical to a filled one. Both dropdown primitives
 * reuse the same string for the stacked label, so the placeholder is derived
 * from it and must never simply repeat it:
 *
 * - a label that already reads as an instruction ("Select a time", "Search
 *   inventory") is used as-is rather than becoming "Select select a time";
 * - unless that would render the same words twice, in which case the control
 *   falls back to the neutral instruction.
 */
export const deriveEmptyLabel = (placeholder: string): string => {
  const label = placeholder.trim();
  const derived = /^(select|search|choose|pick|type|enter)\b/i.test(label)
    ? label
    : `Select ${label.toLowerCase()}`;
  return derived.toLowerCase() === label.toLowerCase() ? 'Select an option' : derived;
};
