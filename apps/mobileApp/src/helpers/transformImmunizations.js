/**
 * Convert raw FHIR “Immunization” data into a simplified array
 * suitable for display in a React Native app.
 *
 * @param {Array<Object>} immunizations Raw JSON from the server
 * @param {Object} [options]
 * @param {boolean} [options.useFhirId=false] If true, use FHIR resource.id as the key
 * @returns {Array<Object>} [{ id, status, vaccine, date, manufacturer, lotNumber, location, nextDue, expiryDate, attachments: [] }]
 */
export function transformImmunizations(
  immunizations,
  { useFhirId = false } = {}
) {
  if (!Array.isArray(immunizations)) return [];

  return immunizations.map((item, idx) => {
    const res = item?.resource || {};
    const id = useFhirId ? res.id : idx;

    const vaccine = res.vaccineCode?.text || 'Unknown Vaccine';
    const status = res.status || 'unknown';
    const date = res.occurrenceDateTime || null;
    const manufacturer = res.manufacturer?.display || null;
    const lotNumber = res.lotNumber || null;
    const location = res.location?.display || null;

    // Extract notes
    let nextDue = null;
    let expiryDate = null;
    (res.note || []).forEach((n) => {
      if (n.text?.startsWith('Next due:')) {
        nextDue = n.text.replace('Next due:', '').trim();
      } else if (n.text?.startsWith('Expiry date:')) {
        expiryDate = n.text.replace('Expiry date:', '').trim();
      }
    });

    // Merge attachments (images + pdfs)
    const attachments = [];
    (res.contained || []).forEach((doc) => {
      (doc?.content || []).forEach((content) => {
        const { attachment } = content;
        const { contentType, title, url } = attachment;

        if (contentType && title && url) {
          const type = contentType.includes('image')
            ? 'image'
            : contentType.includes('pdf')
            ? 'pdf'
            : 'other';

          attachments.push({ title, url, type });
        }
      });
    });

    return {
      id,
      status,
      vaccine,
      date,
      manufacturer,
      lotNumber,
      location,
      nextDue,
      expiryDate,
      attachments,
    };
  });
}
