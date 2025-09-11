// Debug utility for development environment only
const isDevelopment = import.meta.env.DEV;

export const debugLog = (message: string, data?: any) => {
  if (isDevelopment) {
    if (data) {
      console.log(message, data);
    } else {
      console.log(message);
    }
  }
};

export const debugError = (message: string, error?: any) => {
  if (isDevelopment) {
    if (error) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }
};

export const debugWarn = (message: string, data?: any) => {
  if (isDevelopment) {
    if (data) {
      console.warn(message, data);
    } else {
      console.warn(message);
    }
  }
};