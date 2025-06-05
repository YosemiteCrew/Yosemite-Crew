/**
 * Convert the raw FHIR “Patient” bundle you get from the API
 * into the compact array your React‑Native UI expects.
 *
 * @param {Array<Object>} patients  Raw JSON from the server
 * @param {Object} [options]
 * @param {boolean} [options.useFhirId=false]  If true, use the FHIR `resource.id`
 *                                             as the list key; otherwise 0,1,2…
 * @param {string}  [options.fallbackText='Pet'] Fallback prefix when name is missing
 * @returns {Array<Object>} [{ id, title, textColor, petImage }]
 */
export function transformPets(
  patients,
  { useFhirId = false, fallbackText = 'Pet' } = {}
) {
  if (!Array.isArray(patients)) return [];

  return patients.map((p, idx) => {
    const res = p?.resource || {};
    const nameObj = res.name?.[0] || {};
    const title = (nameObj.text || `${fallbackText} ${idx + 1}`).trim();

    // ----- grab the petImage extension (if any) ------------------
    let petImage = null;
    const extensions = res.extension || [];
    for (const ext of extensions) {
      if (ext.title === 'petImage' && ext.valueString) {
        petImage =
          typeof ext.valueString === 'string'
            ? ext.valueString
            : ext.valueString.url ?? null;
        break;
      }
    }
    // -------------------------------------------------------------

    return {
      id: useFhirId ? res.id : idx,
      title,
      textColor: '#3E3E3E',
      petImage, // may be null
    };
  });
}
