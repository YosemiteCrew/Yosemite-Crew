export const getProfileImage = (
  input?: string | File | { name: string; type?: string }
): string => {
  if (!input) {
    return "https://images.unsplash.com/photo-1582750433449-648ed127bb54?q=80&w=687&auto=format&fit=crop&ixlib=rb-4.1.0&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
  }

  if (input instanceof File) {
    return URL.createObjectURL(input);
  }

  if (typeof input === "string") {
    return input;
  }

  // handle object { name, type }
  return input.name || "";
};