// Utility functions for input sanitization and validation

export const sanitizeText = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove script tags
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  
  // Basic email sanitization
  return email
    .toLowerCase()
    .replace(/[^a-z0-9@._-]/g, '')
    .trim();
};

export const sanitizePhone = (phone: string): string => {
  if (!phone) return '';
  
  // Keep only numbers, spaces, hyphens, parentheses, and plus sign
  return phone.replace(/[^\d\s\-\(\)\+]/g, '').trim();
};

export const validateInput = {
  email: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },
  
  phone: (phone: string): boolean => {
    const phoneRegex = /^[\+]?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone);
  },
  
  text: (text: string, maxLength: number = 1000): boolean => {
    return text.length <= maxLength && !/<script/i.test(text);
  },
  
  strongPassword: (password: string): boolean => {
    const requirements = [
      password.length >= 8,
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /\d/.test(password),
      /[!@#$%^&*(),.?":{}|<>]/.test(password)
    ];
    return requirements.every(Boolean);
  }
};

export const sanitizeFormData = <T extends Record<string, any>>(data: T): T => {
  const sanitized = { ...data };
  
  Object.keys(sanitized).forEach(key => {
    const value = sanitized[key];
    if (typeof value === 'string') {
      if (key.includes('email')) {
        sanitized[key] = sanitizeEmail(value);
      } else if (key.includes('phone')) {
        sanitized[key] = sanitizePhone(value);
      } else {
        sanitized[key] = sanitizeText(value);
      }
    }
  });
  
  return sanitized;
};
