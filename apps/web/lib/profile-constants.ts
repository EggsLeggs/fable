import type { SpokenLanguageLevel } from "@fable/db";

export const SITE_LANGUAGES = [{ value: "en", label: "English" }] as const;

export const TIME_FORMATS = [
  { value: "12h" as const, label: "12-hour (1:30 PM)" },
  { value: "24h" as const, label: "24-hour (13:30)" },
];

export const SPOKEN_LANGUAGE_LEVELS: {
  value: SpokenLanguageLevel;
  label: string;
}[] = [
  { value: "elementary", label: "Elementary proficiency" },
  { value: "limited_working", label: "Limited working proficiency" },
  { value: "professional_working", label: "Professional working proficiency" },
  { value: "full_professional", label: "Full professional proficiency" },
  { value: "native", label: "Native or bilingual proficiency" },
];

export const SPOKEN_LANGUAGES = [
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "zh", label: "Chinese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "pt", label: "Portuguese" },
  { value: "it", label: "Italian" },
  { value: "ru", label: "Russian" },
  { value: "ar", label: "Arabic" },
  { value: "nl", label: "Dutch" },
  { value: "pl", label: "Polish" },
  { value: "sv", label: "Swedish" },
  { value: "tr", label: "Turkish" },
  { value: "hi", label: "Hindi" },
  { value: "vi", label: "Vietnamese" },
  { value: "th", label: "Thai" },
  { value: "id", label: "Indonesian" },
  { value: "he", label: "Hebrew" },
];

export const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "Eastern Time (US & Canada)" },
  { value: "America/Chicago", label: "Central Time (US & Canada)" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)" },
  { value: "America/Sao_Paulo", label: "Brasilia" },
  { value: "Europe/London", label: "London" },
  { value: "Europe/Paris", label: "Paris" },
  { value: "Europe/Berlin", label: "Berlin" },
  { value: "Europe/Moscow", label: "Moscow" },
  { value: "Africa/Cairo", label: "Cairo" },
  { value: "Asia/Dubai", label: "Dubai" },
  { value: "Asia/Kolkata", label: "India Standard Time" },
  { value: "Asia/Shanghai", label: "China Standard Time" },
  { value: "Asia/Tokyo", label: "Tokyo" },
  { value: "Asia/Seoul", label: "Seoul" },
  { value: "Asia/Singapore", label: "Singapore" },
  { value: "Australia/Sydney", label: "Sydney" },
  { value: "Pacific/Auckland", label: "Auckland" },
];
