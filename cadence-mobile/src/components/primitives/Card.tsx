import React from 'react';
import { View } from 'react-native';
import type { ReactNode } from 'react';

interface CardProps {
  variant?: 'card' | 'paper';
  padding?: 'sm' | 'md' | 'lg';
  className?: string;
  children: ReactNode;
}

const paddingClass = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
} as const;

export function Card({
  variant = 'card',
  padding = 'md',
  className = '',
  children,
}: CardProps) {
  const backgroundClass = variant === 'paper' ? 'bg-paper' : 'bg-card';

  return (
    <View
      className={`${backgroundClass} border border-hairline rounded-2xl ${paddingClass[padding]} ${className}`}
    >
      {children}
    </View>
  );
}
