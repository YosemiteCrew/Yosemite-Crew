const formatDate = dateString => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-GB'); // 'en-GB' is for British English, which uses DD/MM/YYYY format
};
