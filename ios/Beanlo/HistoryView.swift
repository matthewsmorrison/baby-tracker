import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: Store
    @Binding var editing: Entry?

    private var days: [(key: String, date: Date, entries: [Entry])] {
        let grouped = Dictionary(grouping: store.entries.filter {
            $0.type != .medication || $0.medKind == "dose"
        }) { $0.occurredAt.dayKey }
        return grouped
            .map { (key: $0.key, date: $0.value[0].occurredAt, entries: $0.value) }
            .sorted { $0.key > $1.key }
    }

    var body: some View {
        List {
            ForEach(days, id: \.key) { day in
                Section {
                    ForEach(day.entries) { entry in
                        EntryRow(entry: entry)
                            .contentShape(.rect)
                            .onTapGesture { editing = entry }
                            .swipeActions(edge: .trailing) {
                                Button(role: .destructive) {
                                    Task { try? await store.delete(entry) }
                                } label: {
                                    Label("Delete", systemImage: "trash")
                                }
                                Button {
                                    editing = entry
                                } label: {
                                    Label("Edit", systemImage: "pencil")
                                }
                                .tint(.accent)
                            }
                    }
                } header: {
                    dayHeader(day)
                }
                .listRowBackground(Color.surface)
                .listRowSeparatorTint(Color.line)
            }

            if store.entries.isEmpty && !store.loading {
                ContentUnavailableView(
                    "Nothing logged yet",
                    systemImage: "moon.stars",
                    description: Text("Tap + to log a feed, nappy or weight.")
                )
                .listRowBackground(Color.clear)
            }
        }
        .scrollContentBackground(.hidden)
        .background(Color.sand)
        .navigationTitle("History")
        .refreshable { await store.refresh() }
    }

    private func dayHeader(_ day: (key: String, date: Date, entries: [Entry])) -> some View {
        let dol = store.baby.map { Clinical.dayOfLife(birthAt: $0.birthAt, at: day.date) }
        let nappies = day.entries.filter { $0.type == .nappy }
        let feeds = day.entries.filter { $0.type == .feed }.count
        let tags = store.dayTags.filter { $0.day == day.key }

        return HStack {
            Text("\(dol.map { "Day \($0) · " } ?? "")\(day.date.formatted(.dateTime.weekday(.abbreviated).day().month(.abbreviated)))")
                .font(.system(.footnote, design: .rounded, weight: .bold))
                .foregroundStyle(Color.ink)
            ForEach(tags) { tag in
                Text(tag.tag == "no_poo" ? "no poo" : "teething")
                    .font(.caption2.weight(.semibold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background((tag.tag == "no_poo" ? Color.muted : Color.watch).opacity(0.15), in: .capsule)
                    .foregroundStyle(tag.tag == "no_poo" ? Color.muted : Color.watch)
            }
            Spacer()
            Text("\(nappies.count) nappies · \(feeds) feeds")
                .font(.caption2)
                .foregroundStyle(Color.muted)
        }
        .textCase(nil)
    }
}

struct EntryRow: View {
    let entry: Entry

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: entry.type.symbol)
                .font(.subheadline)
                .foregroundStyle(iconTint)
                .frame(width: 36, height: 36)
                .background(iconTint.opacity(0.12), in: .rect(cornerRadius: 11))

            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(Color.ink)
                if let note = entry.note, !note.isEmpty {
                    Text("“\(note)”")
                        .font(.caption)
                        .foregroundStyle(Color.muted)
                        .lineLimit(1)
                }
            }
            Spacer()
            Text(timeLabel)
                .font(.caption.monospacedDigit())
                .foregroundStyle(Color.muted)
        }
        .padding(.vertical, 2)
    }

    private var iconTint: Color {
        switch entry.type {
        case .nappy: entry.dirty == true ? .chartBrown : .chartBlue
        case .feed: .accent
        case .sleep, .carerSleep: Color(light: 0x4A3AA7, dark: 0x9C8FE0)
        case .weight: .positive
        case .pump: Color(light: 0x0F8A8A, dark: 0x4FB3B3)
        case .temperature: .alertTone
        case .milestone: .accent
        case .medication: Color(light: 0x8A4A7A, dark: 0xC08AB0)
        }
    }

    private var title: String {
        switch entry.type {
        case .nappy:
            return entry.dirty == true ? "Mixed nappy" : "Wet nappy"
        case .feed:
            var parts: [String] = []
            if let l = entry.leftMin, l > 0 { parts.append("L \(l)m") }
            if let r = entry.rightMin, r > 0 { parts.append("R \(r)m") }
            if let e = entry.expressedMl, e > 0 { parts.append("EBM \(e) ml") }
            if let f = entry.formulaMl, f > 0 { parts.append("Formula \(f) ml") }
            if let v = entry.volumeMl, v > 0, parts.isEmpty { parts.append("\(v) ml") }
            return "Feed · " + (parts.isEmpty ? "logged" : parts.joined(separator: " + "))
        case .sleep, .carerSleep:
            if let end = entry.endedAt {
                let mins = Int(end.timeIntervalSince(entry.occurredAt) / 60)
                return "Slept \(mins / 60)h \(mins % 60)m"
            }
            return "Sleeping…"
        case .weight:
            return entry.weightG.map { String(format: "Weight · %.2f kg", Double($0) / 1000) } ?? "Measurement"
        case .pump:
            return "Pumped \(entry.expressedMl ?? 0) ml"
        case .temperature:
            return entry.tempC.map { String(format: "Temp · %.1f °C", $0) } ?? "Temperature"
        case .milestone:
            return entry.milestoneLabel ?? "Milestone"
        case .medication:
            let dose = entry.medDose.map { " \($0)" } ?? ""
            return "\(entry.medName ?? "Medicine")\(dose) · given"
        }
    }

    private var timeLabel: String {
        if let end = entry.endedAt, entry.type == .sleep || entry.type == .feed {
            return "\(entry.occurredAt.timeLabel) – \(end.timeLabel)"
        }
        return entry.occurredAt.timeLabel
    }
}
