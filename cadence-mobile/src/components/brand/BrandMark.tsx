import { Circle, Svg } from 'react-native-svg';

import { colors } from '@/theme/tokens';

interface BrandMarkProps {
  size?: number;
  variant?: 'cream' | 'ink';
}

// Three concentric circles. Outer + middle rings, inner circle filled.
// Source of truth lives at docs/brand/mark-on-cream.svg and mark-on-ink.svg.
// Keep proportions in lockstep with the icon.png raster the designer ships
// — same r=72/52/32 in a 240 viewBox, same 1.5px stroke.
//
// vectorEffect="non-scaling-stroke" keeps strokes at exactly 1.5 physical
// pixels regardless of `size`, which matches DS §1's hairline-borders rule.
export function BrandMark({ size = 80, variant = 'cream' }: BrandMarkProps) {
  // 'cream' = mark renders on cream paper backgrounds; rings + fill are moss.
  // 'ink'   = mark renders on moss-ink dark backgrounds; rings + fill are paper.
  const color = variant === 'cream' ? colors.moss : colors.paper;

  return (
    <Svg width={size} height={size} viewBox="0 0 240 240" fill="none">
      <Circle
        cx={120}
        cy={120}
        r={72}
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Circle
        cx={120}
        cy={120}
        r={52}
        stroke={color}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
      <Circle cx={120} cy={120} r={32} fill={color} />
    </Svg>
  );
}
