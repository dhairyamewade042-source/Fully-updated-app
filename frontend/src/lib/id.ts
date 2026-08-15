// Small helper — avoids pulling in uuid just for a local id.
export const uid = () =>
  `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
