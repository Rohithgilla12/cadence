import React from 'react';
import { Text } from 'react-native';

interface SectionLabelProps {
  label: string;
  className?: string;
}

// Eyebrow label per DS §8 — 11px uppercase, letter-spaced, ink-3. Sits above sections.
export function SectionLabel({ label, className = '' }: SectionLabelProps) {
  return (
    <Text className={`text-eyebrow text-ink-3 uppercase mt-5 mb-3 ${className}`}>
      {label}
    </Text>
  );
}
