/**
 * Typography Scale System
 * Ensures consistent text styling across the entire application
 */

// Heading styles with consistent scale
export const typography = {
  // Page Headings
  h1: "text-4xl font-bold leading-tight text-foreground",
  h2: "text-3xl font-bold leading-tight text-foreground",
  h3: "text-2xl font-semibold leading-snug text-foreground",
  h4: "text-xl font-semibold leading-snug text-foreground",
  h5: "text-lg font-semibold leading-normal text-foreground",
  h6: "text-base font-semibold leading-normal text-foreground",

  // Body Text
  body: {
    large: "text-lg leading-relaxed text-foreground",
    base: "text-base leading-normal text-foreground",
    small: "text-sm leading-normal text-foreground",
  },

  // Labels & Captions
  label: {
    large: "text-sm font-medium leading-normal text-foreground",
    base: "text-sm font-medium leading-normal text-foreground",
    small: "text-xs font-medium leading-normal text-muted-foreground",
  },

  // Card Titles
  cardTitle: "text-lg font-semibold leading-snug text-foreground",
  cardDescription: "text-sm leading-normal text-muted-foreground",

  // Table Headers
  tableHeader: "text-sm font-semibold leading-normal text-foreground",
  tableCell: "text-sm leading-normal text-foreground",

  // Button Text
  buttonLarge: "text-base font-medium leading-normal",
  buttonBase: "text-sm font-medium leading-normal",
  buttonSmall: "text-xs font-medium leading-normal",

  // Metadata & Auxiliary
  metadata: "text-xs leading-normal text-muted-foreground",
  caption: "text-xs leading-normal text-muted-foreground",
  overline: "text-xs font-semibold leading-normal uppercase tracking-wide text-muted-foreground",

  // Links
  link: "text-sm font-medium leading-normal text-primary hover:underline",

  // Error & Helper Text
  error: "text-sm leading-normal text-error",
  helper: "text-xs leading-normal text-muted-foreground",
};

// Utility function to get typography classes
export const getTypography = (
  variant: keyof typeof typography | string
): string => {
  // Handle nested variants (e.g., 'body.large', 'label.small')
  if (variant.includes('.')) {
    const [parent, child] = variant.split('.');
    const parentObj = typography[parent as keyof typeof typography];
    if (parentObj && typeof parentObj === 'object') {
      return (parentObj as any)[child] || '';
    }
  }
  
  const value = typography[variant as keyof typeof typography];
  return typeof value === 'string' ? value : '';
};
