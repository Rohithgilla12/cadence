import { Text, View } from 'react-native';

interface JournalHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

// Onboarding's headline block. Reads like the opening of a chapter:
// a small caps signpost, a serif declarative line, a quiet aside in
// the body voice. The wider letter-spacing on the eyebrow keeps it
// from competing with the title — restraint, not weakness.
export function JournalHeader({ eyebrow, title, subtitle }: JournalHeaderProps) {
  return (
    <View>
      {eyebrow ? (
        <Text
          className="text-eyebrow text-ink-3 uppercase mb-3"
          style={{ letterSpacing: 2.5 }}
        >
          {eyebrow}
        </Text>
      ) : null}
      <Text className="font-serif text-display text-ink leading-tight">
        {title}
      </Text>
      {subtitle ? (
        <Text className="mt-3 text-body text-ink-2 leading-relaxed" style={{ maxWidth: 340 }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}
