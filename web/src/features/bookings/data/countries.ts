export interface CountryData {
  name: string;
  code: string;
  dialCode: string;
}

export const WORLD_COUNTRIES: CountryData[] = [
  { name: 'India', code: 'IN', dialCode: '+91' },
  { name: 'United States', code: 'US', dialCode: '+1' },
  { name: 'United Kingdom', code: 'GB', dialCode: '+44' },
  { name: 'United Arab Emirates', code: 'AE', dialCode: '+971' },
  { name: 'Saudi Arabia', code: 'SA', dialCode: '+966' },
  { name: 'Singapore', code: 'SG', dialCode: '+65' },
  { name: 'Australia', code: 'AU', dialCode: '+61' },
  { name: 'Canada', code: 'CA', dialCode: '+1' },
  { name: 'Germany', code: 'DE', dialCode: '+49' },
  { name: 'France', code: 'FR', dialCode: '+33' },
  { name: 'Qatar', code: 'QA', dialCode: '+974' },
  { name: 'Kuwait', code: 'KW', dialCode: '+965' },
  { name: 'Oman', code: 'OM', dialCode: '+968' },
  { name: 'Bahrain', code: 'BH', dialCode: '+973' },
  { name: 'Malaysia', code: 'MY', dialCode: '+60' },
  { name: 'Thailand', code: 'TH', dialCode: '+66' },
  { name: 'Japan', code: 'JP', dialCode: '+81' },
  { name: 'South Korea', code: 'KR', dialCode: '+82' },
  { name: 'China', code: 'CN', dialCode: '+86' },
  { name: 'Hong Kong', code: 'HK', dialCode: '+852' },
  { name: 'Netherlands', code: 'NL', dialCode: '+31' },
  { name: 'Italy', code: 'IT', dialCode: '+39' },
  { name: 'Spain', code: 'ES', dialCode: '+34' },
  { name: 'Switzerland', code: 'CH', dialCode: '+41' },
  { name: 'Sweden', code: 'SE', dialCode: '+46' },
  { name: 'Norway', code: 'NO', dialCode: '+47' },
  { name: 'Denmark', code: 'DK', dialCode: '+45' },
  { name: 'Finland', code: 'FI', dialCode: '+358' },
  { name: 'Russia', code: 'RU', dialCode: '+7' },
  { name: 'South Africa', code: 'ZA', dialCode: '+27' },
  { name: 'Brazil', code: 'BR', dialCode: '+55' },
  { name: 'Mexico', code: 'MX', dialCode: '+52' },
  { name: 'New Zealand', code: 'NZ', dialCode: '+64' },
  { name: 'Philippines', code: 'PH', dialCode: '+63' },
  { name: 'Indonesia', code: 'ID', dialCode: '+62' },
  { name: 'Vietnam', code: 'VN', dialCode: '+84' },
  { name: 'Egypt', code: 'EG', dialCode: '+20' },
  { name: 'Turkey', code: 'TR', dialCode: '+90' },
  { name: 'Israel', code: 'IL', dialCode: '+972' },
  { name: 'Nigeria', code: 'NG', dialCode: '+234' },
  { name: 'Kenya', code: 'KE', dialCode: '+254' },
  { name: 'Sri Lanka', code: 'LK', dialCode: '+94' },
  { name: 'Nepal', code: 'NP', dialCode: '+977' },
  { name: 'Bangladesh', code: 'BD', dialCode: '+880' },
  { name: 'Pakistan', code: 'PK', dialCode: '+92' },
  { name: 'Maldives', code: 'MV', dialCode: '+960' },
  { name: 'Afghanistan', code: 'AF', dialCode: '+93' },
  { name: 'Albania', code: 'AL', dialCode: '+355' },
  { name: 'Algeria', code: 'DZ', dialCode: '+213' },
  { name: 'Andorra', code: 'AD', dialCode: '+376' },
  { name: 'Angola', code: 'AO', dialCode: '+244' },
  { name: 'Argentina', code: 'AR', dialCode: '+54' },
  { name: 'Armenia', code: 'AM', dialCode: '+374' },
  { name: 'Austria', code: 'AT', dialCode: '+43' },
  { name: 'Azerbaijan', code: 'AZ', dialCode: '+994' },
  { name: 'Belarus', code: 'BY', dialCode: '+375' },
  { name: 'Belgium', code: 'BE', dialCode: '+32' },
  { name: 'Belize', code: 'BZ', dialCode: '+501' },
  { name: 'Bhutan', code: 'BT', dialCode: '+975' },
  { name: 'Bolivia', code: 'BO', dialCode: '+591' },
  { name: 'Bosnia and Herzegovina', code: 'BA', dialCode: '+387' },
  { name: 'Botswana', code: 'BW', dialCode: '+267' },
  { name: 'Brunei', code: 'BN', dialCode: '+673' },
  { name: 'Bulgaria', code: 'BG', dialCode: '+359' },
  { name: 'Cambodia', code: 'KH', dialCode: '+855' },
  { name: 'Cameroon', code: 'CM', dialCode: '+237' },
  { name: 'Chile', code: 'CL', dialCode: '+56' },
  { name: 'Colombia', code: 'CO', dialCode: '+57' },
  { name: 'Costa Rica', code: 'CR', dialCode: '+506' },
  { name: 'Croatia', code: 'HR', dialCode: '+385' },
  { name: 'Cyprus', code: 'CY', dialCode: '+357' },
  { name: 'Czech Republic', code: 'CZ', dialCode: '+420' },
  { name: 'Dominican Republic', code: 'DO', dialCode: '+1' },
  { name: 'Ecuador', code: 'EC', dialCode: '+593' },
  { name: 'El Salvador', code: 'SV', dialCode: '+503' },
  { name: 'Estonia', code: 'EE', dialCode: '+372' },
  { name: 'Ethiopia', code: 'ET', dialCode: '+251' },
  { name: 'Fiji', code: 'FJ', dialCode: '+679' },
  { name: 'Georgia', code: 'GE', dialCode: '+995' },
  { name: 'Ghana', code: 'GH', dialCode: '+233' },
  { name: 'Greece', code: 'GR', dialCode: '+30' },
  { name: 'Guatemala', code: 'GT', dialCode: '+502' },
  { name: 'Honduras', code: 'HN', dialCode: '+504' },
  { name: 'Hungary', code: 'HU', dialCode: '+36' },
  { name: 'Iceland', code: 'IS', dialCode: '+354' },
  { name: 'Iran', code: 'IR', dialCode: '+98' },
  { name: 'Iraq', code: 'IQ', dialCode: '+964' },
  { name: 'Ireland', code: 'IE', dialCode: '+353' },
  { name: 'Jamaica', code: 'JM', dialCode: '+1' },
  { name: 'Jordan', code: 'JO', dialCode: '+962' },
  { name: 'Kazakhstan', code: 'KZ', dialCode: '+7' },
  { name: 'Laos', code: 'LA', dialCode: '+856' },
  { name: 'Latvia', code: 'LV', dialCode: '+371' },
  { name: 'Lebanon', code: 'LB', dialCode: '+961' },
  { name: 'Lithuania', code: 'LT', dialCode: '+370' },
  { name: 'Luxembourg', code: 'LU', dialCode: '+352' },
  { name: 'Macau', code: 'MO', dialCode: '+853' },
  { name: 'Malta', code: 'MT', dialCode: '+356' },
  { name: 'Mauritius', code: 'MU', dialCode: '+230' },
  { name: 'Moldova', code: 'MD', dialCode: '+373' },
  { name: 'Monaco', code: 'MC', dialCode: '+377' },
  { name: 'Mongolia', code: 'MN', dialCode: '+976' },
  { name: 'Montenegro', code: 'ME', dialCode: '+382' },
  { name: 'Morocco', code: 'MA', dialCode: '+212' },
  { name: 'Myanmar', code: 'MM', dialCode: '+95' },
  { name: 'Nicaragua', code: 'NI', dialCode: '+505' },
  { name: 'North Macedonia', code: 'MK', dialCode: '+389' },
  { name: 'Panama', code: 'PA', dialCode: '+507' },
  { name: 'Paraguay', code: 'PY', dialCode: '+595' },
  { name: 'Peru', code: 'PE', dialCode: '+51' },
  { name: 'Poland', code: 'PL', dialCode: '+48' },
  { name: 'Portugal', code: 'PT', dialCode: '+351' },
  { name: 'Romania', code: 'RO', dialCode: '+40' },
  { name: 'Rwanda', code: 'RW', dialCode: '+250' },
  { name: 'Serbia', code: 'RS', dialCode: '+381' },
  { name: 'Seychelles', code: 'SC', dialCode: '+248' },
  { name: 'Slovakia', code: 'SK', dialCode: '+421' },
  { name: 'Slovenia', code: 'SI', dialCode: '+386' },
  { name: 'Tanzania', code: 'TZ', dialCode: '+255' },
  { name: 'Tunisia', code: 'TN', dialCode: '+216' },
  { name: 'Uganda', code: 'UG', dialCode: '+256' },
  { name: 'Ukraine', code: 'UA', dialCode: '+380' },
  { name: 'Uruguay', code: 'UY', dialCode: '+598' },
  { name: 'Uzbekistan', code: 'UZ', dialCode: '+998' },
  { name: 'Venezuela', code: 'VE', dialCode: '+58' },
  { name: 'Zambia', code: 'ZM', dialCode: '+260' },
  { name: 'Zimbabwe', code: 'ZW', dialCode: '+263' },
];

/**
 * Finds a country by dialCode, name, or ISO code
 */
export function findCountry(query: string): CountryData | undefined {
  if (!query) return undefined;
  const clean = query.trim().toLowerCase();

  // 1. Direct dialCode match (e.g. "+91" or "91")
  const sorted = [...WORLD_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  if (clean.startsWith('+')) {
    const matched = sorted.find((c) => clean.startsWith(c.dialCode.toLowerCase()));
    if (matched) return matched;
  }

  // 2. Dial code without plus prefix e.g. "971"
  const digitsMatch = sorted.find((c) => c.dialCode.replace('+', '') === clean);
  if (digitsMatch) return digitsMatch;

  // 3. Exact ISO code match e.g. "IN", "US", "AE"
  const codeMatch = WORLD_COUNTRIES.find((c) => c.code.toLowerCase() === clean);
  if (codeMatch) return codeMatch;

  // 4. Exact or partial country name match e.g. "India", "United Arab Emirates"
  const nameMatch = WORLD_COUNTRIES.find((c) => c.name.toLowerCase() === clean);
  if (nameMatch) return nameMatch;

  const partialNameMatch = WORLD_COUNTRIES.find(
    (c) => c.name.toLowerCase().includes(clean) || clean.includes(c.name.toLowerCase())
  );
  return partialNameMatch;
}
