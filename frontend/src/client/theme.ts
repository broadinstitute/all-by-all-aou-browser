export const lightTheme = {
  background: '#fafafa',
  surface: '#ffffff',
  surfaceAlt: '#f5f5f5',
  text: '#1e1e5a',
  textMuted: '#666666',
  border: '#e0e0e0',
  primary: '#262262',
  headerBg: '#262262',
  headerText: '#ffffff',
  tooltipBg: 'rgba(255, 255, 255, 0.98)',
  stripe: '#ffffff',
};

export const darkTheme = {
  background: '#1a1d24',
  surface: '#242832',
  surfaceAlt: '#2d323e',
  text: '#e8eaed',
  textMuted: '#9aa0a6',
  border: '#3c4354',
  primary: '#8ab4f8',
  headerBg: '#1f2937',
  headerText: '#e8eaed',
  tooltipBg: 'rgba(36, 40, 50, 0.98)',
  stripe: '#1e222b',
};

export type ThemeType = typeof lightTheme;
