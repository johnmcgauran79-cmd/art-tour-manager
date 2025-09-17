
// Utility functions for input sanitization and validation

import { sanitizeAndFormatPhone } from './phoneFormatter';

export const sanitizeText = (input: string): string => {
  if (!input) return '';
  
  return input
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();
};

export const sanitizeEmail = (email: string): string => {
  if (!email) return '';
  return email.toLowerCase().replace(/[^a-z0-9@._-]/g, '').trim();
};

export const sanitizePhone = (phone: string): string => {
  if (!phone) return '';
  return sanitizeAndFormatPhone(phone);
};

export const validateInput = {
  email: (email: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
  phone: (phone: string): boolean => /^\+\d{10,15}$/.test(phone),
  text: (text: string, maxLength: number = 1000): boolean => 
    text.length <= maxLength && !/<script/i.test(text),
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
  const sanitized = {} as T;
  
  Object.keys(data).forEach(key => {
    const value = data[key];
    if (typeof value === 'string') {
      if (key.includes('email')) {
        (sanitized as any)[key] = sanitizeEmail(value);
      } else if (key.includes('phone')) {
        (sanitized as any)[key] = sanitizePhone(value);
      } else {
        (sanitized as any)[key] = sanitizeText(value);
      }
    } else {
      (sanitized as any)[key] = value;
    }
  });
  
  return sanitized;
};
