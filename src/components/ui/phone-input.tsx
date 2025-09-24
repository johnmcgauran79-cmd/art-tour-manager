import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { COUNTRY_CODES, formatPhoneForWhatsApp, detectPhoneCountry, getPhoneDisplayFormat } from "@/utils/phoneFormatter";
import { cn } from "@/lib/utils";

interface PhoneInputProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export const PhoneInput = ({ 
  value, 
  onChange, 
  onBlur,
  placeholder = "Enter phone number",
  className,
  label,
  required = false,
  disabled = false
}: PhoneInputProps) => {
  const [selectedCountry, setSelectedCountry] = useState('AU');
  const [inputValue, setInputValue] = useState(value || '');
  const [isValid, setIsValid] = useState(true);

  // Update selected country when value changes (useful for editing existing contacts)
  useEffect(() => {
    if (value) {
      const detectedCountry = detectPhoneCountry(value);
      if (detectedCountry) {
        setSelectedCountry(detectedCountry);
      }
      setInputValue(value);
    }
  }, [value]);

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode);
    
    // If there's an existing number, try to reformat it with the new country
    if (inputValue) {
      const formatted = formatPhoneForWhatsApp(inputValue, countryCode);
      if (formatted) {
        setInputValue(formatted);
        onChange(formatted);
        setIsValid(true);
      }
    }
  };

  const handleInputChange = (newValue: string) => {
    setInputValue(newValue);
    
    // Don't format while typing if it already has a country code
    if (newValue.startsWith('+')) {
      onChange(newValue);
      setIsValid(newValue.length === 0 || /^\+\d{8,15}$/.test(newValue));
    } else {
      onChange(newValue);
      setIsValid(true);
    }
  };

  const handleInputBlur = () => {
    if (inputValue && !inputValue.startsWith('+')) {
      const formatted = formatPhoneForWhatsApp(inputValue, selectedCountry);
      if (formatted) {
        setInputValue(formatted);
        onChange(formatted);
        setIsValid(true);
      } else if (inputValue) {
        setIsValid(false);
      }
    }
    onBlur?.();
  };

  const selectedCountryData = COUNTRY_CODES.find(c => c.code === selectedCountry);

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      
      <div className="flex gap-2">
        <Select
          value={selectedCountry}
          onValueChange={handleCountryChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue>
              {selectedCountryData && (
                <span className="flex items-center gap-2">
                  <span className="text-xs">{selectedCountryData.code}</span>
                  <span className="text-sm">{selectedCountryData.dialCode}</span>
                </span>
              )}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {COUNTRY_CODES.map((country) => (
              <SelectItem key={country.code} value={country.code}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">{country.code}</span>
                  <span className="text-sm">{country.dialCode}</span>
                  <span className="text-xs text-muted-foreground">{country.name}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <div className="flex-1">
          <Input
            type="tel"
            value={inputValue}
            onChange={(e) => handleInputChange(e.target.value)}
            onBlur={handleInputBlur}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={cn(
              !isValid && "border-red-500 focus:border-red-500",
              isValid && inputValue && "border-green-500"
            )}
          />
          {!isValid && (
            <p className="text-xs text-red-500 mt-1">
              Please enter a valid phone number
            </p>
          )}
          {isValid && inputValue && (
            <p className="text-xs text-muted-foreground mt-1">
              {getPhoneDisplayFormat(inputValue)}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};