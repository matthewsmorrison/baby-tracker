import SwiftUI

/// The app's standard card — soft surface, hairline border, gentle shadow.
struct Card<Content: View>: View {
    var padding: CGFloat = 18
    @ViewBuilder var content: Content

    var body: some View {
        content
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(padding)
            .background(Color.surface, in: .rect(cornerRadius: 24))
            .overlay(
                RoundedRectangle(cornerRadius: 24)
                    .strokeBorder(Color.line.opacity(0.6), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.05), radius: 14, y: 6)
    }
}

struct CardTitle: View {
    let text: String
    init(_ text: String) { self.text = text }
    var body: some View {
        Text(text)
            .font(.system(.subheadline, design: .rounded, weight: .bold))
            .foregroundStyle(.secondary)
            .textCase(.uppercase)
            .kerning(0.4)
            .font(.caption)
    }
}

/// Pick-one / toggle chip used across forms and day tags.
struct Chip: View {
    let label: String
    var systemImage: String?
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            HStack(spacing: 6) {
                if let systemImage {
                    Image(systemName: systemImage).font(.caption)
                }
                Text(label)
            }
            .font(.system(.subheadline, design: .rounded, weight: .semibold))
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(active ? Color.ink : Color.surfaceAlt, in: .capsule)
            .foregroundStyle(active ? Color.onInk : Color.muted)
            .overlay(Capsule().strokeBorder(active ? .clear : Color.line, lineWidth: 1))
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.2), value: active)
    }
}

/// KPI tile for the Today grid.
struct StatTile: View {
    let label: String
    let value: String
    var sub: String?
    var tone: Color = .ink

    var body: some View {
        Card(padding: 16) {
            VStack(alignment: .leading, spacing: 4) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(Color.muted)
                Text(value)
                    .font(.stat(28))
                    .foregroundStyle(tone)
                    .contentTransition(.numericText())
                if let sub {
                    Text(sub)
                        .font(.caption2)
                        .foregroundStyle(Color.faint)
                }
            }
        }
    }
}

/// In-app rear-camera capture for nappy photos (UIKit picker wrapper).
struct CameraCapture: UIViewControllerRepresentable {
    @Environment(\.dismiss) private var dismiss
    let onCapture: (Data) -> Void

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        if UIImagePickerController.isSourceTypeAvailable(.camera) {
            picker.sourceType = .camera
            picker.cameraDevice = .rear
        }
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        let parent: CameraCapture
        init(_ parent: CameraCapture) { self.parent = parent }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            if let image = info[.originalImage] as? UIImage, let data = image.compressedJPEG() {
                parent.onCapture(data)
            }
            parent.dismiss()
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            parent.dismiss()
        }
    }
}

extension Date {
    /// Local calendar key, e.g. "2026-07-04" — matches the web app's dayKey.
    var dayKey: String {
        let f = DateFormatter()
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: self)
    }

    var timeLabel: String {
        formatted(date: .omitted, time: .shortened)
    }
}
