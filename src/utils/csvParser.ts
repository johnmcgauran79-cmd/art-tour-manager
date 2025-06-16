
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
  
  console.log('=== CSV HEADER ANALYSIS ===');
  console.log('Raw headers from CSV:', rawHeaders);
  console.log('Normalized headers (lowercase):', headers);

  const contacts: CSVContact[] = [];
  const validationErrors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // Skip empty lines

    console.log(`\n=== Processing Row ${i} ===`);
    console.log('Raw line:', line);

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

    console.log(`Parsed values (${values.length}):`, values);

    const contact: any = {};

    // Map headers to values with detailed logging
    headers.forEach((header, index) => {
      const rawValue = values[index];
      console.log(`  ${header} [${index}]: "${rawValue}" (raw header: "${rawHeaders[index]}")`);
      
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
      
      console.log(`    Cleaned value for ${header}: "${cleanValue}"`);
      
      // Only add non-empty values
      if (cleanValue && cleanValue !== '' && cleanValue !== 'undefined' && cleanValue !== 'null') {
        contact[header] = cleanValue;
        console.log(`    ✓ Added to contact: ${header} = "${cleanValue}"`);
      } else {
        console.log(`    ✗ Skipped empty/invalid value for ${header}`);
      }
    });

    console.log(`Final contact object:`, contact);

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

    console.log(`Final formatted contact:`, formattedContact);
    contacts.push(formattedContact);
  }

  console.log(`\n=== FINAL RESULTS ===`);
  console.log(`Total contacts parsed: ${contacts.length}`);
  
  return { contacts, errors: validationErrors };
};

export { type CSVContact };
