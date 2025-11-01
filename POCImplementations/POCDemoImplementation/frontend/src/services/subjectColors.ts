import type { SubjectColors } from '@/types';

/**
 * Map subject names to color classes
 * Based on the requirements: color-coded by subject type
 */
export const getSubjectColor = (subjectName: string): string => {
  const normalized = subjectName.toLowerCase().trim();
  
  // Direct matches
  const subjectColors: SubjectColors = {
    // Math
    'mathematics': 'subject-math',
    'math': 'subject-math',
    'maths': 'subject-math',
    
    // Science
    'science': 'subject-science',
    'physics': 'subject-science',
    'chemistry': 'subject-science',
    'biology': 'subject-science',
    
    // English
    'english': 'subject-english',
    'language': 'subject-english',
    'reading': 'subject-english',
    'writing': 'subject-english',
    'literature': 'subject-english',
    
    // Arts
    'art': 'subject-arts',
    'arts': 'subject-arts',
    'drawing': 'subject-arts',
    'painting': 'subject-arts',
    
    // PE
    'pe': 'subject-pe',
    'physical education': 'subject-pe',
    'sports': 'subject-pe',
    'gym': 'subject-pe',
    
    // Geography
    'geography': 'subject-geography',
    'social studies': 'subject-geography',
    
    // History
    'history': 'subject-history',
    
    // Music
    'music': 'subject-music',
    'choir': 'subject-music',
    
    // Other common subjects
    'assembly': 'subject-default',
    'registration': 'subject-default',
    'break': 'subject-default',
    'lunch': 'subject-default',
    'recess': 'subject-default',
  };
  
  // Check for direct match
  if (subjectColors[normalized]) {
    return subjectColors[normalized];
  }
  
  // Check for partial matches
  for (const [key, color] of Object.entries(subjectColors)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return color;
    }
  }
  
  return 'subject-default';
};

/**
 * Get hex color value for a subject
 */
export const getSubjectHexColor = (subjectName: string): string => {
  const className = getSubjectColor(subjectName);
  
  const colorMap: Record<string, string> = {
    'subject-math': '#3b82f6',
    'subject-science': '#10b981',
    'subject-english': '#f59e0b',
    'subject-arts': '#ec4899',
    'subject-pe': '#8b5cf6',
    'subject-geography': '#14b8a6',
    'subject-history': '#ef4444',
    'subject-music': '#f97316',
    'subject-default': '#6b7280',
  };
  
  return colorMap[className] || colorMap['subject-default'];
};

