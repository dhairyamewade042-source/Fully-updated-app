// Central theme tokens for GarlicLedger Pro
// Palette: strict green + white per design guidelines.

export const lightTheme = {
  surface: "#F4F7F4",
  onSurface: "#1A1F1C",
  surfaceSecondary: "#FFFFFF",
  onSurfaceSecondary: "#2E3630",
  surfaceTertiary: "#E8F0E9",
  onSurfaceTertiary: "#1F4D29",
  surfaceInverse: "#1A1F1C",
  onSurfaceInverse: "#FFFFFF",
  brand: "#2E7D32",
  brandPrimary: "#2E7D32",
  onBrandPrimary: "#FFFFFF",
  brandSecondary: "#C8E6C9",
  onBrandSecondary: "#1B5E20",
  brandTertiary: "#E8F5E9",
  onBrandTertiary: "#1B5E20",
  success: "#2E7D32",
  onSuccess: "#FFFFFF",
  warning: "#F57F17",
  onWarning: "#FFFFFF",
  error: "#D32F2F",
  onError: "#FFFFFF",
  info: "#455A64",
  onInfo: "#FFFFFF",
  border: "#E0E8E1",
  borderStrong: "#B9C8BA",
  divider: "#EAF0EB",
  muted: "#5C6B5F",
};

export const darkTheme: typeof lightTheme = {
  surface: "#0F1411",
  onSurface: "#E8EFEA",
  surfaceSecondary: "#1A211D",
  onSurfaceSecondary: "#E8EFEA",
  surfaceTertiary: "#152018",
  onSurfaceTertiary: "#C8E6C9",
  surfaceInverse: "#FFFFFF",
  onSurfaceInverse: "#1A1F1C",
  brand: "#66BB6A",
  brandPrimary: "#66BB6A",
  onBrandPrimary: "#0F1411",
  brandSecondary: "#2E7D32",
  onBrandSecondary: "#E8F5E9",
  brandTertiary: "#1B5E20",
  onBrandTertiary: "#E8F5E9",
  success: "#66BB6A",
  onSuccess: "#0F1411",
  warning: "#FFB74D",
  onWarning: "#0F1411",
  error: "#EF5350",
  onError: "#0F1411",
  info: "#90A4AE",
  onInfo: "#0F1411",
  border: "#26302A",
  borderStrong: "#3D4A40",
  divider: "#1F2823",
  muted: "#8DA093",
};

export type Theme = typeof lightTheme;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 20,
  xxl: 24,
  display: 32,
};
