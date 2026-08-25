import SwiftUI
import PhotosUI
import Supabase

/// Consultation notes: questions to ask + notes to remember, tagged to
/// carers, with answers recorded at the appointment — same table and rules
/// as the web (baby_notes, RLS).
struct NotesView: View {
    @EnvironmentObject private var store: Store
    @StateObject private var notes = NotesStore()
    @State private var lightboxURL: URL?
    @State private var showAnswered = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                if store.canEdit {
                    NoteComposer(notes: notes)
                }

                let open = notes.items.filter { $0.kind != "note" && $0.answer == nil }
                let plain = notes.items.filter { $0.kind == "note" }
                let answered = notes.items.filter { $0.kind != "note" && $0.answer != nil }

                if notes.items.isEmpty && !notes.loading {
                    ContentUnavailableView(
                        "Nothing noted yet",
                        systemImage: "notebook",
                        description: Text("Questions for the midwife, things to remember — and Bea can use them all when you ask her things.")
                    )
                }

                if !open.isEmpty {
                    section("To ask (\(open.count))", open)
                }
                if !plain.isEmpty {
                    section("Notes (\(plain.count))", plain)
                }
                if !answered.isEmpty {
                    Button {
                        withAnimation(.snappy) { showAnswered.toggle() }
                    } label: {
                        HStack {
                            Text("Answered (\(answered.count))")
                                .font(.system(.subheadline, design: .rounded, weight: .bold))
                                .foregroundStyle(Color.muted)
                            Image(systemName: "chevron.right")
                                .font(.caption2.weight(.bold))
                                .foregroundStyle(Color.faint)
                                .rotationEffect(.degrees(showAnswered ? 90 : 0))
                        }
                    }
                    if showAnswered {
                        VStack(spacing: 10) {
                            ForEach(answered) { note in
                                NoteCard(note: note, notes: notes, lightboxURL: $lightboxURL)
                            }
                        }
                    }
                }

                Spacer(minLength: 90)
            }
            .padding(16)
        }
        .background(Color.sand)
        .navigationTitle("Notes")
        .refreshable { await notes.load() }
        .task {
            notes.configure(store: store)
            await notes.load()
        }
        .fullScreenCover(item: Binding(
            get: { lightboxURL.map { NoteLightboxItem(url: $0) } },
            set: { lightboxURL = $0?.url }
        )) { item in
            Lightbox(url: item.url) { lightboxURL = nil }
        }
    }

    private func section(_ title: String, _ items: [BabyNote]) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(title)
                .font(.system(.subheadline, design: .rounded, weight: .bold))
                .foregroundStyle(Color.muted)
            ForEach(items) { note in
                NoteCard(note: note, notes: notes, lightboxURL: $lightboxURL)
            }
        }
    }
}

private struct NoteLightboxItem: Identifiable {
    let url: URL
    var id: String { url.absoluteString }
}

// MARK: - Composer

private struct NoteComposer: View {
    @EnvironmentObject private var store: Store
    @ObservedObject var notes: NotesStore
    @State private var kind = "question"
    @State private var body_ = ""
    @State private var tagged: Set<UUID> = []
    @State private var photos: [PhotosPickerItem] = []
    @State private var busy = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 12) {
                Picker("Kind", selection: $kind) {
                    Text("Question").tag("question")
                    Text("Note").tag("note")
                }
                .pickerStyle(.segmented)

                TextField(
                    kind == "question"
                        ? "e.g. Is their weight gain on track? Should we keep topping up with formula?"
                        : "e.g. Midwife said to keep an eye on the latch",
                    text: $body_, axis: .vertical
                )
                .lineLimit(2...5)
                .font(.system(.body, design: .rounded))

                Text(kind == "question" ? "Who is this for?" : "Tag anyone (optional)")
                    .font(.caption)
                    .foregroundStyle(Color.muted)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 130), spacing: 8)], spacing: 8) {
                    ForEach(store.carers) { carer in
                        Chip(
                            label: "\(carer.id == store.userId ? "You" : carer.name ?? carer.email ?? "Carer") · \(carer.role == "viewer" ? "healthcare" : carer.role)",
                            active: tagged.contains(carer.id)
                        ) {
                            if tagged.contains(carer.id) { tagged.remove(carer.id) } else { tagged.insert(carer.id) }
                        }
                    }
                }

                PhotosPicker(selection: $photos, maxSelectionCount: 4, matching: .images) {
                    Label(photos.isEmpty ? "Add photos (optional)" : "\(photos.count) photo\(photos.count == 1 ? "" : "s") attached",
                          systemImage: "photo.badge.plus")
                        .font(.system(.subheadline, design: .rounded, weight: .medium))
                }

                Button {
                    Task { await submit() }
                } label: {
                    Group {
                        if busy { ProgressView() } else { Text(kind == "question" ? "Add question" : "Add note") }
                    }
                    .font(.system(.body, design: .rounded, weight: .semibold))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 4)
                }
                .buttonStyle(.glassProminent)
                .disabled(busy || body_.trimmingCharacters(in: .whitespaces).isEmpty)
            }
        }
        .task { await store.loadCarers() }
    }

    private func submit() async {
        busy = true
        var imageDatas: [Data] = []
        for item in photos {
            if let data = try? await item.loadTransferable(type: Data.self),
               let image = UIImage(data: data),
               let jpeg = image.compressedJPEG() {
                imageDatas.append(jpeg)
            }
        }
        await notes.create(kind: kind, body: body_, tagged: Array(tagged), photos: imageDatas)
        body_ = ""
        tagged = []
        photos = []
        busy = false
        Haptics.success()
    }
}

// MARK: - Note card

private struct NoteCard: View {
    @EnvironmentObject private var store: Store
    let note: BabyNote
    @ObservedObject var notes: NotesStore
    @Binding var lightboxURL: URL?

    @State private var answering = false
    @State private var answerText = ""
    @State private var drafting = false
    @State private var confirmDelete = false

    var body: some View {
        Card {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: note.answer != nil ? "checkmark.circle.fill"
                          : note.kind == "note" ? "note.text" : "questionmark.circle")
                        .foregroundStyle(note.answer != nil ? Color.positive : Color.accent)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(note.body)
                            .font(.system(.subheadline, design: .rounded))
                        HStack(spacing: 6) {
                            ForEach(note.taggedUserIds, id: \.self) { id in
                                if let carer = store.carers.first(where: { $0.id == id }) {
                                    Text(carer.id == store.userId ? "You" : carer.name ?? carer.email ?? "Carer")
                                        .font(.caption2.weight(.semibold))
                                        .padding(.horizontal, 7)
                                        .padding(.vertical, 2)
                                        .background(Color.accentSoft, in: .capsule)
                                        .foregroundStyle(Color.accent)
                                }
                            }
                        }
                        Text(note.createdAt.formatted(.dateTime.weekday(.abbreviated).day().month().hour().minute()))
                            .font(.caption2)
                            .foregroundStyle(Color.faint)
                    }
                    Spacer()
                    if store.canEdit {
                        Menu {
                            Button(role: .destructive) {
                                Task { await notes.delete(note) }
                            } label: {
                                Label("Delete", systemImage: "trash")
                            }
                        } label: {
                            Image(systemName: "ellipsis").foregroundStyle(Color.faint).padding(4)
                        }
                    }
                }

                if let paths = note.photoPaths, !paths.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(paths, id: \.self) { path in
                                PhotoThumb(path: path) { url in lightboxURL = url }
                                    .frame(width: 56, height: 56)
                            }
                        }
                    }
                }

                if note.kind != "note" {
                    if let answer = note.answer {
                        VStack(alignment: .leading, spacing: 4) {
                            Text(answer)
                                .font(.system(.subheadline, design: .rounded))
                            HStack {
                                if let at = note.answeredAt {
                                    Text("recorded \(at.formatted(.dateTime.day().month().hour().minute()))")
                                        .font(.caption2).foregroundStyle(Color.faint)
                                }
                                Spacer()
                                if store.canEdit {
                                    Button("Reopen") {
                                        Task { await notes.setAnswer(note, answer: nil) }
                                    }
                                    .font(.caption)
                                    .foregroundStyle(Color.muted)
                                }
                            }
                        }
                        .padding(10)
                        .background(Color.positive.opacity(0.08), in: .rect(cornerRadius: 12))
                    } else if answering {
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("What did they say?", text: $answerText, axis: .vertical)
                                .lineLimit(2...6)
                                .font(.system(.subheadline, design: .rounded))
                                .padding(10)
                                .background(Color.surfaceAlt, in: .rect(cornerRadius: 12))
                            HStack {
                                Button("Save answer") {
                                    Task {
                                        await notes.setAnswer(note, answer: answerText)
                                        answering = false
                                    }
                                }
                                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                                .disabled(answerText.trimmingCharacters(in: .whitespaces).isEmpty)
                                Button("Cancel") { answering = false }
                                    .font(.subheadline)
                                    .foregroundStyle(Color.muted)
                                Spacer()
                                if store.aiEnabled {
                                    Button {
                                        Task {
                                            drafting = true
                                            answerText = await notes.draftWithBea(note) ?? answerText
                                            drafting = false
                                        }
                                    } label: {
                                        Label(drafting ? "Drafting…" : "Draft with Bea", systemImage: "sparkles")
                                            .font(.caption.weight(.semibold))
                                    }
                                    .disabled(drafting)
                                }
                            }
                        }
                    } else if store.canEdit {
                        Button {
                            answering = true
                        } label: {
                            Label("Record the answer", systemImage: "plus")
                                .font(.system(.caption, design: .rounded, weight: .semibold))
                        }
                    }
                }
            }
        }
    }
}

// MARK: - Notes store

@MainActor
final class NotesStore: ObservableObject {
    @Published var items: [BabyNote] = []
    @Published var loading = false
    private weak var store: Store?

    func configure(store: Store) {
        self.store = store
    }

    func load() async {
        guard let store, let baby = store.baby else { return }
        loading = items.isEmpty
        items = (try? await store.supabase
            .from("baby_notes")
            .select()
            .eq("baby_id", value: baby.id)
            .order("created_at", ascending: false)
            .execute().value) ?? []
        loading = false
    }

    func create(kind: String, body: String, tagged: [UUID], photos: [Data]) async {
        guard let store, let baby = store.baby, let userId = store.userId else { return }
        struct NewNote: Encodable {
            let baby_id: UUID
            let kind: String
            let body: String
            let tagged_user_ids: [UUID]
            let created_by: UUID
        }
        guard let created: BabyNote = try? await store.supabase
            .from("baby_notes")
            .insert(NewNote(baby_id: baby.id, kind: kind, body: body.trimmingCharacters(in: .whitespacesAndNewlines), tagged_user_ids: tagged, created_by: userId))
            .select()
            .single()
            .execute().value
        else { return }
        items.insert(created, at: 0)

        if !photos.isEmpty {
            var paths: [String] = []
            for (i, data) in photos.enumerated() {
                let path = "\(baby.id.uuidString.lowercased())/note-\(created.id.uuidString.lowercased())-\(i).jpg"
                if (try? await store.supabase.storage.from("nappy-photos").upload(
                    path, data: data, options: FileOptions(contentType: "image/jpeg", upsert: true)
                )) != nil {
                    paths.append(path)
                }
            }
            struct P: Encodable { let photo_paths: [String] }
            _ = try? await store.supabase.from("baby_notes")
                .update(P(photo_paths: paths))
                .eq("id", value: created.id)
                .execute()
            if let i = items.firstIndex(where: { $0.id == created.id }) {
                items[i].photoPaths = paths
            }
        }
    }

    func setAnswer(_ note: BabyNote, answer: String?) async {
        guard let store else { return }
        struct A: Encodable {
            let answer: String?
            let answered_at: String?
            let answered_by: UUID?
        }
        let trimmed = answer?.trimmingCharacters(in: .whitespacesAndNewlines)
        _ = try? await store.supabase.from("baby_notes")
            .update(A(
                answer: trimmed?.isEmpty == false ? trimmed : nil,
                answered_at: trimmed?.isEmpty == false ? Date().ISO8601Format() : nil,
                answered_by: trimmed?.isEmpty == false ? store.userId : nil
            ))
            .eq("id", value: note.id)
            .execute()
        await load()
        Haptics.success()
    }

    func delete(_ note: BabyNote) async {
        guard let store else { return }
        if let paths = note.photoPaths, !paths.isEmpty {
            _ = try? await store.supabase.storage.from("nappy-photos").remove(paths: paths)
        }
        try? await store.supabase.from("baby_notes").delete().eq("id", value: note.id).execute()
        items.removeAll { $0.id == note.id }
    }

    /// Bea writes a draft answer from the tracked data (Advanced tier).
    func draftWithBea(_ note: BabyNote) async -> String? {
        guard let store else { return nil }
        do {
            let request = try await store.apiRequest("/api/notes/draft", body: [
                "noteId": note.id.uuidString.lowercased(),
                "tz": TimeZone.current.identifier,
            ])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { return nil }
            struct Draft: Decodable { let draft: String? }
            return (try? JSONDecoder().decode(Draft.self, from: data))?.draft
        } catch {
            return nil
        }
    }
}

extension UIImage {
    /// Client-side compression matching the web's photo pipeline.
    func compressedJPEG(maxDimension: CGFloat = 1600, quality: CGFloat = 0.75) -> Data? {
        let scale = min(1, maxDimension / max(size.width, size.height))
        let newSize = CGSize(width: size.width * scale, height: size.height * scale)
        let renderer = UIGraphicsImageRenderer(size: newSize)
        let resized = renderer.image { _ in draw(in: CGRect(origin: .zero, size: newSize)) }
        return resized.jpegData(compressionQuality: quality)
    }
}
