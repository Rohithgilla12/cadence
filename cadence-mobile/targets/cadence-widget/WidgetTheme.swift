// Mirrors `src/theme/tokens.ts`. Widgets cannot import the JS theme, so the
// values are duplicated here. If you change a token in `tokens.ts`, change
// it here too — keep them in lockstep.

import SwiftUI

enum WidgetTheme {
    // Ink (text)
    static let ink = Color(red: 0x2C / 255, green: 0x35 / 255, blue: 0x28 / 255)
    static let ink2 = Color(red: 0x5A / 255, green: 0x5A / 255, blue: 0x52 / 255)
    static let ink3 = Color(red: 0x9A / 255, green: 0x9A / 255, blue: 0x92 / 255)

    // Surfaces
    static let paper = Color(red: 0xF4 / 255, green: 0xF3 / 255, blue: 0xED / 255)
    static let paper2 = Color(red: 0xEA / 255, green: 0xE8 / 255, blue: 0xDE / 255)

    // Moss
    static let moss = Color(red: 0x4A / 255, green: 0x5A / 255, blue: 0x40 / 255)
    static let mossLight = Color(red: 0x7A / 255, green: 0x8A / 255, blue: 0x6F / 255)
    static let mossLighter = Color(red: 0xA3 / 255, green: 0xB3 / 255, blue: 0x9A / 255)
    static let mossBg = Color(red: 0xEE / 255, green: 0xF1 / 255, blue: 0xE8 / 255)

    // Hairlines (DS §2)
    static let hairline = Color.black.opacity(0.08)
    static let hairline2 = Color.black.opacity(0.16)

    // Serif font for numbers and headlines (DS §3 — Iowan Old Style is on
    // every iOS device; fall back is automatic).
    static func serif(size: CGFloat, weight: Font.Weight = .medium) -> Font {
        Font.custom("Iowan Old Style", size: size).weight(weight)
    }
}
