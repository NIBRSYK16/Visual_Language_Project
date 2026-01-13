/**
 * 国家名称到 ISO 代码的映射
 * 用于 world-atlas 数据（使用国家名称而不是 ISO 代码）
 */

/**
 * world-atlas 国家名称到 ISO 代码的映射
 * world-atlas 使用的是完整的国家名称
 */
export const countryNameToISO: Record<string, string> = {
  // 主要国家 - 完整名称映射（world-atlas 使用的格式）
  'United States of America': 'USA',
  'United States': 'USA',
  'China': 'CHN',
  'United Kingdom': 'GBR',
  'Germany': 'DEU',
  'France': 'FRA',
  'Japan': 'JPN',
  'Canada': 'CAN',
  'Italy': 'ITA',
  'Spain': 'ESP',
  'India': 'IND',
  'Australia': 'AUS',
  'South Korea': 'KOR',
  'Korea': 'KOR',
  'Netherlands': 'NLD',
  'Switzerland': 'CHE',
  'Sweden': 'SWE',
  'Singapore': 'SGP',
  'Israel': 'ISR',
  'Brazil': 'BRA',
  'Russia': 'RUS',
  'Russian Federation': 'RUS',
  'Belgium': 'BEL',
  'Austria': 'AUT',
  'Denmark': 'DNK',
  'Finland': 'FIN',
  'Norway': 'NOR',
  'Poland': 'POL',
  'Taiwan': 'TWN',
  'Hong Kong': 'HKG',
  'Ireland': 'IRL',
  'New Zealand': 'NZL',
  'Portugal': 'PRT',
  'Greece': 'GRC',
  'Czech Republic': 'CZE',
  'Czechia': 'CZE',
  'Turkey': 'TUR',
  'Mexico': 'MEX',
  'Chile': 'CHL',
  'Argentina': 'ARG',
  'South Africa': 'ZAF',
  'Egypt': 'EGY',
  'Thailand': 'THA',
  'Malaysia': 'MYS',
  'Indonesia': 'IDN',
  'Philippines': 'PHL',
  'Vietnam': 'VNM',
  'Saudi Arabia': 'SAU',
  'United Arab Emirates': 'ARE',
  'Romania': 'ROU',
};

/**
 * 将国家名称转换为 ISO 3166-1 alpha-3 代码
 */
export function getNameToISO(countryName: string): string {
  if (!countryName) return '';
  
  const normalized = countryName.trim();
  return countryNameToISO[normalized] || countryNameToISO[normalized.toUpperCase()] || '';
}
