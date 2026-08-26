import SwiftUI

// Beanlo's warm sand palette (ported from the web app's globals.css) —
// shared by the app and the widget extension.
extension Color {
    static let sand = Color(light: 0xEDE9E1, dark: 0x16140F)
    static let sandGlow = Color(light: 0xF6E3C6, dark: 0x2B2418)
    static let surface = Color(light: 0xFFFFFF, dark: 0x201D16)
    static let surfaceAlt = Color(light: 0xFAF8F3, dark: 0x29251D)
    static let ink = Color(light: 0x1B1B1A, dark: 0xF1EDE4)
    static let onInk = Color(light: 0xFFFFFF, dark: 0x16140F)
    static let muted = Color(light: 0x8C8677, dark: 0xA49D8D)
    static let faint = Color(light: 0xB4AE9F, dark: 0x6B6558)
    static let line = Color(light: 0xE7E1D6, dark: 0x322E26)
    static let accent = Color(light: 0xE9A23B, dark: 0xEAA94D)
    static let accentSoft = Color(light: 0xF7E9CF, dark: 0x3A301C)
    static let positive = Color(light: 0x3C6B4E, dark: 0x8FC39B)
    static let positiveBar = Color(light: 0x7FB08A, dark: 0x6F9E7C)
    static let alertTone = Color(light: 0xC0483B, dark: 0xEC8F82)
    static let watch = Color(light: 0xA4571B, dark: 0xE0A24A)
    static let chartBlue = Color(light: 0x2A78D6, dark: 0x5B9BE0)
    static let chartBrown = Color(light: 0x7A5A3A, dark: 0xA0805C)

    init(light: UInt32, dark: UInt32) {
        self.init(uiColor: UIColor { trait in
            let hex = trait.userInterfaceStyle == .dark ? dark : light
            return UIColor(
                red: CGFloat((hex >> 16) & 0xFF) / 255,
                green: CGFloat((hex >> 8) & 0xFF) / 255,
                blue: CGFloat(hex & 0xFF) / 255,
                alpha: 1
            )
        })
    }
}

extension Font {
    /// Big rounded numerals — the app's signature stat style.
    static func stat(_ size: CGFloat, weight: Font.Weight = .bold) -> Font {
        .system(size: size, weight: weight, design: .rounded)
    }
}
