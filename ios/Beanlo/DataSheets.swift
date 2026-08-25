import SwiftUI
import UniformTypeIdentifiers

// MARK: - Printable report (native twin of /report)

struct ReportSheet: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                report
                    .padding(20)
            }
            .background(Color.sand)
            .navigationTitle("Tracking summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    ShareLink(item: renderPDF()) {
                        Label("Share", systemImage: "square.and.arrow.up")
                    }
                }
            }
        }
    }

    private struct DaySummary: Identifiable {
        let id: String
        let date: Date
        let dol: Int
        let feeds: String
        let nappies: String
        let sleep: String
    }

    private var summaries: [DaySummary] {
        guard let baby = store.baby else { return [] }
        let groups = Dictionary(grouping: store.entries) { $0.occurredAt.dayKey }
        return groups.map { key, entries in
            let s = Clinical.summariseFeeds(entries)
            var feedBits: [String] = []
            if s.breastMin > 0 { feedBits.append("\(s.breastMin)m nursing") }
            if s.expressedMl > 0 { feedBits.append("\(s.expressedMl)ml EBM") }
            if s.formulaMl > 0 { feedBits.append("\(s.formulaMl)ml formula") }
            let nappies = entries.filter { $0.type == .nappy }
            let dirty = nappies.filter { $0.dirty == true }.count
            let sleepMins = entries.filter { $0.type == .sleep }.reduce(0.0) { total, e in
                guard let end = e.endedAt else { return total }
                return total + end.timeIntervalSince(e.occurredAt) / 60
            }
            let date = entries[0].occurredAt
            return DaySummary(
                id: key,
                date: date,
                dol: Clinical.dayOfLife(birthAt: baby.birthAt, at: date),
                feeds: "\(s.sessions)\(feedBits.isEmpty ? "" : " (\(feedBits.joined(separator: ", ")))")",
                nappies: "\(nappies.count - dirty) wet · \(dirty) mixed",
                sleep: sleepMins > 0 ? "\(Int(sleepMins) / 60)h \(Int(sleepMins) % 60)m" : "—"
            )
        }
        .sorted { $0.id > $1.id }
    }

    private var report: some View {
        VStack(alignment: .leading, spacing: 16) {
            if let baby = store.baby {
                VStack(alignment: .leading, spacing: 4) {
                    Text("\(baby.name) — tracking summary")
                        .font(.system(.title3, design: .rounded, weight: .bold))
                    Text("Born \(baby.birthAt.formatted(.dateTime.weekday(.wide).day().month(.wide).year().hour().minute())) · \(String(format: "%.2f kg", Double(baby.birthWeightG) / 1000)) at birth · day \(Clinical.dayOfLife(birthAt: baby.birthAt)) today")
                        .font(.footnote)
                        .foregroundStyle(Color.muted)
                    Text("Generated \(Date().formatted(.dateTime.day().month().year().hour().minute()))")
                        .font(.caption2)
                        .foregroundStyle(Color.faint)
                }

                let weights = store.entries.filter { $0.type == .weight && $0.weightG != nil }
                if !weights.isEmpty {
                    Card {
                        VStack(alignment: .leading, spacing: 8) {
                            CardTitle("Weights")
                            ForEach(weights) { w in
                                HStack {
                                    Text(w.occurredAt.formatted(.dateTime.day().month()))
                                    Text("day \(Clinical.dayOfLife(birthAt: baby.birthAt, at: w.occurredAt))")
                                        .foregroundStyle(Color.muted)
                                    Spacer()
                                    Text(String(format: "%.2f kg", Double(w.weightG!) / 1000)).bold()
                                    Text(String(format: "%+.1f%%", Clinical.weightStatus(weightG: w.weightG!, birthWeightG: baby.birthWeightG).pct))
                                        .foregroundStyle(Color.muted)
                                }
                                .font(.system(.caption, design: .rounded))
                            }
                        }
                    }
                }

                Card {
                    VStack(alignment: .leading, spacing: 8) {
                        CardTitle("Daily summary")
                        ForEach(summaries) { day in
                            VStack(alignment: .leading, spacing: 1) {
                                Text("Day \(day.dol) · \(day.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))")
                                    .font(.system(.caption, design: .rounded, weight: .bold))
                                Text("Feeds \(day.feeds) · Nappies \(day.nappies) · Sleep \(day.sleep)")
                                    .font(.caption2)
                                    .foregroundStyle(Color.muted)
                            }
                            .padding(.vertical, 2)
                        }
                    }
                }

                Text(Clinical.disclaimer)
                    .font(.caption2)
                    .foregroundStyle(Color.faint)
            }
        }
    }

    @MainActor
    private func renderPDF() -> URL {
        let url = FileManager.default.temporaryDirectory.appendingPathComponent("beanlo-report.pdf")
        let renderer = ImageRenderer(content: report.frame(width: 560).padding(24).background(Color.white).environmentObject(store))
        renderer.render { size, render in
            var box = CGRect(origin: .zero, size: size)
            guard let context = CGContext(url as CFURL, mediaBox: &box, nil) else { return }
            context.beginPDFPage(nil)
            render(context)
            context.endPDFPage()
            context.closePDF()
        }
        return url
    }
}

// MARK: - AI handover summary (native twin of /report/handover)

struct HandoverSheet: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var markdown: String?
    @State private var busy = false
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if let markdown {
                        Text("Written by Bea from the tracked data. Not medical advice — for discussion with your healthcare professional.")
                            .font(.caption)
                            .foregroundStyle(Color.muted)
                        Text(LocalizedStringKey(markdown))
                            .font(.system(.subheadline, design: .rounded))
                            .textSelection(.enabled)
                    } else if busy {
                        HStack {
                            Spacer()
                            ProgressView("Bea is writing the summary…")
                            Spacer()
                        }
                        .padding(.top, 60)
                    } else {
                        Text("Bea writes a one-page summary of the tracked data — feeding pattern, weight trajectory, nappy output and your open questions — to hand to a midwife, health visitor or GP.")
                            .font(.subheadline)
                            .foregroundStyle(Color.muted)
                        Button("Generate summary") {
                            Task { await generate() }
                        }
                        .buttonStyle(.glassProminent)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.alertTone)
                    }
                }
                .padding(18)
            }
            .background(Color.sand)
            .navigationTitle("Handover summary")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                if let markdown {
                    ToolbarItem(placement: .confirmationAction) {
                        ShareLink(item: markdown) {
                            Image(systemName: "square.and.arrow.up")
                        }
                    }
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Redo") {
                            Task { await generate() }
                        }
                        .disabled(busy)
                    }
                }
            }
        }
        .task {
            // Show the latest stored report if one exists.
            if let baby = store.baby {
                struct Report: Decodable { let content: String }
                let stored: [Report] = (try? await store.supabase
                    .from("handover_reports")
                    .select("content")
                    .eq("baby_id", value: baby.id)
                    .order("created_at", ascending: false)
                    .limit(1)
                    .execute().value) ?? []
                if markdown == nil { markdown = stored.first?.content }
            }
        }
    }

    private func generate() async {
        busy = true
        error = nil
        do {
            let request = try await store.apiRequest("/api/handover", body: ["tz": TimeZone.current.identifier])
            let (data, response) = try await URLSession.shared.data(for: request)
            guard (response as? HTTPURLResponse)?.statusCode == 200 else { throw URLError(.badServerResponse) }
            struct R: Decodable { let content: String? }
            markdown = (try? JSONDecoder().decode(R.self, from: data))?.content ?? String(data: data, encoding: .utf8)
        } catch {
            self.error = "Couldn't generate the summary — try again in a moment."
        }
        busy = false
    }
}

// MARK: - Huckleberry import

struct ImportSheet: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var showPicker = false
    @State private var plan: Huckleberry.Plan?
    @State private var busy = false
    @State private var result: String?
    @State private var error: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    Text("Moving over? In Huckleberry, tap your child's icon → “Export tracking data as CSV”, then open the emailed file here. Times are read in this device's timezone. Nothing is saved until you confirm.")
                        .font(.subheadline)
                        .foregroundStyle(Color.muted)

                    Button {
                        showPicker = true
                    } label: {
                        Label("Choose CSV file", systemImage: "doc.badge.plus")
                            .font(.system(.body, design: .rounded, weight: .semibold))
                    }
                    .buttonStyle(.glass)

                    if let plan {
                        Card {
                            VStack(alignment: .leading, spacing: 6) {
                                let counts = Dictionary(grouping: plan.drafts, by: \.type)
                                    .map { ($0.key, $0.value.count) }
                                    .sorted { $0.1 > $1.1 }
                                ForEach(counts, id: \.0) { type, n in
                                    Text("\(n) \(type.label.lowercased())\(n == 1 ? "" : "s")")
                                        .font(.system(.subheadline, design: .rounded))
                                }
                                if !plan.skipped.isEmpty {
                                    Text("No beanlo equivalent (skipped): \(plan.skipped.map { "\($0.key) ×\($0.value)" }.joined(separator: ", "))")
                                        .font(.caption2)
                                        .foregroundStyle(Color.faint)
                                }
                                if !plan.problems.isEmpty {
                                    DisclosureGroup("\(plan.problems.count) rows couldn't be read (skipped, not guessed)") {
                                        ForEach(plan.problems, id: \.self) { p in
                                            Text(p).font(.caption2).foregroundStyle(Color.faint)
                                        }
                                    }
                                    .font(.caption)
                                }
                                Button {
                                    Task { await runImport() }
                                } label: {
                                    Group {
                                        if busy { ProgressView() } else { Text("Import \(plan.drafts.count) entries") }
                                    }
                                    .frame(maxWidth: .infinity)
                                }
                                .buttonStyle(.glassProminent)
                                .disabled(busy || plan.drafts.isEmpty)
                            }
                        }
                    }
                    if let result {
                        Text(result).font(.subheadline).foregroundStyle(Color.positive)
                    }
                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.alertTone)
                    }
                }
                .padding(18)
            }
            .background(Color.sand)
            .navigationTitle("Import from Huckleberry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .fileImporter(isPresented: $showPicker, allowedContentTypes: [.commaSeparatedText, .plainText]) { fileResult in
            switch fileResult {
            case .success(let url):
                guard url.startAccessingSecurityScopedResource(),
                      let text = try? String(contentsOf: url, encoding: .utf8),
                      let baby = store.baby, let userId = store.userId
                else {
                    error = "Couldn't read that file."
                    return
                }
                url.stopAccessingSecurityScopedResource()
                plan = Huckleberry.plan(csv: text, babyId: baby.id, userId: userId)
                result = nil
                error = nil
            case .failure:
                error = "Couldn't open that file."
            }
        }
    }

    private func runImport() async {
        guard let plan else { return }
        busy = true
        do {
            let (imported, duplicates) = try await store.importEntries(plan.drafts)
            result = "Imported \(imported) entries" + (duplicates > 0 ? " (\(duplicates) already existed — skipped)." : ".")
            self.plan = nil
            Haptics.success()
        } catch {
            self.error = "Import failed — nothing partial was left behind incorrectly; try again."
        }
        busy = false
    }
}

extension UIImage {
    /// Square 256px avatar crop + JPEG, matching the web's avatar pipeline.
    func squareAvatarJPEG() -> Data? {
        let side = min(size.width, size.height)
        let origin = CGPoint(x: (size.width - side) / 2, y: (size.height - side) / 2)
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: 256, height: 256))
        let cropped = renderer.image { _ in
            draw(in: CGRect(x: -origin.x * 256 / side, y: -origin.y * 256 / side,
                            width: size.width * 256 / side, height: size.height * 256 / side))
        }
        return cropped.jpegData(compressionQuality: 0.8)
    }
}
