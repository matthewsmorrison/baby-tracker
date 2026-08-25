import SwiftUI

// Colours and the stat font live in SharedKit/Palette.swift (shared with the
// widget extension). App-only helpers stay here.

enum Haptics {
    static func tap() {
        UIImpactFeedbackGenerator(style: .light).impactOccurred()
    }
    static func success() {
        UINotificationFeedbackGenerator().notificationOccurred(.success)
    }
}
