
interface CSVContact {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  city?: string;
  state?: string;
  country?: string;
  spouse_name?: string;
  dietary_requirements?: string;
  notes?: string;
}

export const parseCSV = (text: string): { contacts: CSVContact[], errors: string[] } => {
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length < 2) return { contacts: [], errors: [] };

  // Parse headers and normalize to lowercase for case-insensitive matching
  const headerLine = lines[0];
  const rawHeaders = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
  const headers = rawHeaders.map(h => h.toLowerCase());
  
  // Development logging - consider removing in production
  if (process.env.NODE_ENV === 'development') {
    console.log('Raw headers from CSV:', rawHeaders);
    console.log('Normalized headers (lowercase):', headers);
  }

  const contacts: CSVContact[] = [];
  const validationErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    if (process.env.NODE_ENV === 'development') {
      console.log(`Processing Row ${i}:`, line);
    }

    // Simple CSV parsing - split by comma and handle basic quoted values
    const values = [];
    let currentValue = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if ((char === '"' || char === "'") && (j === 0 || line[j-1] === ',')) {
        inQuotes = true;
      } else if ((char === '"' || char === "'") && inQuotes && (j === line.length - 1 || line[j+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim());
        currentValue = '';
      } else {
        currentValue += char;
      }
    }
    values.push(currentValue.trim()); // Add the last value

    // Development logging
    if (process.env.NODE_ENV === 'development') {
      console.log(`Parsed values (${values.length}):`, values);
    }

    const contact: any = {};

    // Map headers to values
    headers.forEach((header, index) => {
      const rawValue = values[index];
      
      // Clean the value
      let cleanValue = rawValue;
      if (cleanValue) {
        cleanValue = cleanValue.trim();
        // Remove surrounding quotes
        if ((cleanValue.startsWith('"') && cleanValue.endsWith('"')) || 
            (cleanValue.startsWith("'") && cleanValue.endsWith("'"))) {
          cleanValue = cleanValue.slice(1, -1);
        }
      }
      
      // Only add non-empty values
      if (cleanValue && cleanValue !== '' && cleanValue !== 'undefined' && cleanValue !== 'null') {
        contact[header] = cleanValue;
      }
    });

    // Validate required fields
    if (!contact.first_name || !contact.last_name) {
      validationErrors.push(`Row ${i + 1}: first_name and last_name are required`);
      continue;
    }

    // Ensure we have the expected structure with proper field mapping
    const formattedContact: CSVContact = {
      first_name: contact.first_name,
      last_name: contact.last_name,
      email: contact.email || undefined,
      phone: contact.phone || undefined,
      city: contact.city || undefined,
      state: contact.state || undefined,
      country: contact.country || undefined,
      spouse_name: contact.spouse_name || undefined,
      dietary_requirements: contact.dietary_requirements || undefined,
      notes: contact.notes || undefined,
    };

    contacts.push(formattedContact);
  }

  if (process.env.NODE_ENV === 'development') {
    console.log(`Total contacts parsed: ${contacts.length}`);
  }
  
  return { contacts, errors: validationErrors };
};

export { type CSVContact };
