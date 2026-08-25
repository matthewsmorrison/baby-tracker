import SwiftUI

/// Log or edit any entry type. Presented as a sheet from the floating + or
/// from a History row.
struct LogSheet: View {
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss

    let initialType: EntryType
    var editing: Entry?

    @State private var type: EntryType = .nappy
    @State private var occurredAt = Date()
    @State private var note = ""
    @State private var busy = false
    @State private var error: String?

    // Nappy
    @State private var dirty = false
    @State private var stoolColour: StoolColour?
    @State private var nappyWeightText = ""
    // Feed — breast minutes live in the app-global timer (store.feedTimer)
    // for new entries so they survive closing the sheet; editing uses plain
    // local steppers.
    @State private var leftMin = 0
    @State private var rightMin = 0
    @State private var expressedMl = 0
    @State private var formulaMl = 0
    // Sleep
    @State private var sleepEnd = Date()
    @State private var sleepOngoing = true
    // Measurements
    @State private var weightKgText = ""
    @State private var lengthCmText = ""
    @State private var headCmText = ""
    // Pump
    @State private var pumpMl = 0
    // Temperature
    @State private var tempText = ""
    // Medication
    @State private var medName = ""
    @State private var medDose = ""
    @State private var medForMother = false
    // Milestone
    @State private var milestoneText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    if editing == nil {
                        typePicker
                    }
                    form
                    notesField
                    whenPicker

                    if let error {
                        Text(error).font(.footnote).foregroundStyle(Color.alertTone)
                    }
                }
                .padding(18)
            }
            .background(Color.sand)
            .navigationTitle(editing == nil ? "Log \(type.label.lowercased())" : "Edit \(type.label.lowercased())")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button {
                        Task { await save() }
                    } label: {
                        if busy { ProgressView() } else { Text("Save").bold() }
                    }
                    .disabled(busy || !valid)
                }
            }
        }
        .presentationDetents([.large])
        .presentationBackground(Color.sand)
        .onAppear { hydrate() }
    }

    // MARK: - Pieces

    private var typePicker: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(store.trackedTypes) { t in
                    Chip(label: t.label, systemImage: t.symbol, active: type == t) {
                        withAnimation(.snappy) { type = t }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var form: some View {
        switch type {
        case .nappy:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    CardTitle("What was in it?")
                    HStack(spacing: 10) {
                        BigChoice(label: "Wet only", symbol: "drop.fill", tint: .chartBlue, active: !dirty) {
                            withAnimation(.snappy) { dirty = false }
                        }
                        BigChoice(label: "Mixed", symbol: "aqi.medium", tint: .chartBrown, active: dirty) {
                            withAnimation(.snappy) { dirty = true }
                        }
                    }
                    Text("Mixed = a nappy with poo (we assume wee too).")
                        .font(.caption2).foregroundStyle(Color.faint)

                    if dirty {
                        CardTitle("Poo colour (optional)")
                        LazyVGrid(columns: [GridItem(.adaptive(minimum: 96), spacing: 8)], spacing: 8) {
                            ForEach(StoolColour.allCases) { colour in
                                swatchChip(colour)
                            }
                        }
                        if let stoolColour, stoolColour.warns {
                            Text("Pale/chalky stool or blood always needs same-day advice — contact your midwife or doctor.")
                                .font(.caption)
                                .foregroundStyle(Color.alertTone)
                        }
                    }

                    CardTitle("Nappy weight (optional)")
                    HStack {
                        TextField(store.baby?.nappyBaseWeightG.map { "dry nappy is \($0) g" } ?? "grams", text: $nappyWeightText)
                            .keyboardType(.numberPad)
                            .font(.system(.body, design: .rounded))
                        Text("g").font(.caption).foregroundStyle(Color.muted)
                    }
                }
            }

        case .feed:
            Card {
                VStack(alignment: .leading, spacing: 16) {
                    CardTitle("Breast")
                    if editing == nil {
                        liveTimerRow(.left)
                        liveTimerRow(.right)
                    } else {
                        editStepperRow(label: "Left", minutes: $leftMin)
                        editStepperRow(label: "Right", minutes: $rightMin)
                    }
                    Divider()
                    CardTitle("Bottle")
                    MlStepper(label: "Expressed milk", value: $expressedMl)
                    MlStepper(label: "Formula", value: $formulaMl)
                }
            }

        case .sleep, .carerSleep:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle(isOn: $sleepOngoing.animation(.snappy)) {
                        Text("Still asleep").font(.system(.body, design: .rounded, weight: .medium))
                    }
                    .tint(.accent)
                    if !sleepOngoing {
                        DatePicker("Woke at", selection: $sleepEnd, displayedComponents: [.date, .hourAndMinute])
                            .font(.system(.body, design: .rounded))
                    }
                }
            }

        case .weight:
            Card {
                VStack(alignment: .leading, spacing: 14) {
                    CardTitle("Weight")
                    HStack {
                        TextField("4.20", text: $weightKgText)
                            .keyboardType(.decimalPad)
                            .font(.stat(34))
                        Text("kg").font(.system(.title3, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    Divider()
                    CardTitle("Length (optional)")
                    HStack {
                        TextField("54.5", text: $lengthCmText)
                            .keyboardType(.decimalPad)
                            .font(.stat(24))
                        Text("cm").font(.system(.body, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    CardTitle("Head circumference (optional)")
                    HStack {
                        TextField("37.0", text: $headCmText)
                            .keyboardType(.decimalPad)
                            .font(.stat(24))
                        Text("cm").font(.system(.body, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    Text("Weight is optional too when logging just length or head — fill in whatever was measured.")
                        .font(.caption2).foregroundStyle(Color.faint)
                }
            }

        case .pump:
            Card {
                MlStepper(label: "Total expressed", value: $pumpMl)
            }

        case .temperature:
            Card {
                VStack(alignment: .leading, spacing: 10) {
                    CardTitle("Temperature")
                    HStack {
                        TextField("37.0", text: $tempText)
                            .keyboardType(.decimalPad)
                            .font(.stat(34))
                        Text("°C").font(.system(.title3, design: .rounded)).foregroundStyle(Color.muted)
                    }
                    Text("38°C or higher in a baby under 3 months needs same-day advice.")
                        .font(.caption2).foregroundStyle(Color.watch)
                }
            }

        case .medication:
            Card {
                VStack(alignment: .leading, spacing: 12) {
                    TextField("Medicine (e.g. Vitamin D)", text: $medName)
                        .font(.system(.body, design: .rounded))
                    TextField("Dose (e.g. 1 drop)", text: $medDose)
                        .font(.system(.body, design: .rounded))
                    HStack(spacing: 8) {
                        Chip(label: "For baby", active: !medForMother) { medForMother = false }
                        Chip(label: "For mother", active: medForMother) { medForMother = true }
                    }
                }
            }

        case .milestone:
            Card {
                TextField("First smile…", text: $milestoneText)
                    .font(.system(.body, design: .rounded))
            }
        }
    }

    /// New-entry row: play/pause drives the app-global timer (which also
    /// runs the lock-screen Live Activity); the stepper adjusts banked time
    /// while paused.
    private func liveTimerRow(_ side: FeedSide) -> some View {
        let running = store.feedTimer.side == side
        return HStack(spacing: 12) {
            Button {
                Haptics.tap()
                store.toggleFeedTimer(side)
            } label: {
                Image(systemName: running ? "pause.fill" : "play.fill")
                    .font(.body.weight(.semibold))
                    .foregroundStyle(running ? Color.onInk : Color.ink)
                    .frame(width: 42, height: 42)
                    .background(running ? Color.ink : Color.surfaceAlt, in: .circle)
                    .overlay(Circle().strokeBorder(Color.line, lineWidth: running ? 0 : 1))
            }
            .buttonStyle(.plain)

            Text(side.label).font(.system(.body, design: .rounded, weight: .medium))
            Spacer()
            TimelineView(.periodic(from: .now, by: 1)) { context in
                let secs = Int(store.feedTimer.total(side, at: context.date))
                HStack(spacing: 0) {
                    Text(String(format: "%d:%02d", secs / 60, secs % 60))
                        .font(.stat(22))
                        .monospacedDigit()
                        .foregroundStyle(running ? Color.accent : Color.ink)
                    Text(" min").font(.caption).foregroundStyle(Color.muted)
                }
            }
            Stepper("", value: Binding(
                get: { Int(store.feedTimer.total(side) / 60) },
                set: { store.setFeedTimerMinutes(side, $0) }
            ), in: 0...180)
            .labelsHidden()
            .disabled(running)
        }
    }

    private func swatchChip(_ colour: StoolColour) -> some View {
        let active = stoolColour == colour
        return Button {
            Haptics.tap()
            withAnimation(.snappy) { stoolColour = active ? nil : colour }
        } label: {
            HStack(spacing: 6) {
                Circle()
                    .fill(Color(light: colour.swatch, dark: colour.swatch))
                    .frame(width: 14, height: 14)
                    .overlay(Circle().strokeBorder(Color.line, lineWidth: 1))
                Text(colour.label)
                    .font(.system(.caption, design: .rounded, weight: .semibold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.8)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(active ? Color.accentSoft : Color.surfaceAlt, in: .rect(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(active ? Color.accent : Color.line, lineWidth: active ? 1.5 : 1)
            )
            .foregroundStyle(Color.ink)
        }
        .buttonStyle(.plain)
    }

    private func editStepperRow(label: String, minutes: Binding<Int>) -> some View {
        HStack(spacing: 12) {
            Text(label).font(.system(.body, design: .rounded, weight: .medium))
            Spacer()
            HStack(spacing: 0) {
                Text("\(minutes.wrappedValue)")
                    .font(.stat(22))
                    .contentTransition(.numericText())
                Text(" min").font(.caption).foregroundStyle(Color.muted)
            }
            Stepper("", value: minutes, in: 0...180).labelsHidden()
        }
    }

    private var notesField: some View {
        Card {
            TextField("Anything worth remembering (optional)", text: $note, axis: .vertical)
                .lineLimit(2...4)
                .font(.system(.body, design: .rounded))
        }
    }

    private var whenPicker: some View {
        Card {
            DatePicker("When", selection: $occurredAt, in: ...Date().addingTimeInterval(60), displayedComponents: [.date, .hourAndMinute])
                .font(.system(.body, design: .rounded, weight: .medium))
        }
    }

    // MARK: - Save

    private var valid: Bool {
        switch type {
        case .feed:
            if editing != nil { return leftMin + rightMin + expressedMl + formulaMl > 0 }
            return store.feedTimer.isActive || expressedMl + formulaMl > 0
        case .weight:
            return [weightKgText, lengthCmText, headCmText]
                .contains { Double($0.replacingOccurrences(of: ",", with: ".")) != nil }
        case .pump: return pumpMl > 0
        case .temperature: return Double(tempText.replacingOccurrences(of: ",", with: ".")) != nil
        case .medication: return !medName.trimmingCharacters(in: .whitespaces).isEmpty
        case .milestone: return !milestoneText.trimmingCharacters(in: .whitespaces).isEmpty
        default: return true
        }
    }

    private func hydrate() {
        type = initialType
        #if DEBUG
        if UserDefaults.standard.bool(forKey: "DevDirty") { dirty = true }
        #endif
        guard let e = editing else { return }
        occurredAt = e.occurredAt
        note = e.note ?? ""
        dirty = e.dirty ?? false
        stoolColour = e.stoolColour.flatMap(StoolColour.init(rawValue:))
        nappyWeightText = e.nappyWeightG.map(String.init) ?? ""
        if let mm = e.lengthMm { lengthCmText = String(format: "%.1f", Double(mm) / 10) }
        if let mm = e.headCircMm { headCmText = String(format: "%.1f", Double(mm) / 10) }
        leftMin = e.leftMin ?? 0
        rightMin = e.rightMin ?? 0
        expressedMl = e.expressedMl ?? 0
        formulaMl = e.formulaMl ?? 0
        if let end = e.endedAt { sleepEnd = end; sleepOngoing = false }
        if let g = e.weightG { weightKgText = String(format: "%.2f", Double(g) / 1000) }
        pumpMl = e.expressedMl ?? 0
        if let t = e.tempC { tempText = String(format: "%.1f", t) }
        medName = e.medName ?? ""
        medDose = e.medDose ?? ""
        medForMother = e.medSubject == "mother"
        milestoneText = e.milestoneLabel ?? ""
    }

    private func save() async {
        guard let baby = store.baby, let userId = store.userId else { return }
        // Bank a running side so its seconds count.
        if type == .feed, editing == nil, let running = store.feedTimer.side {
            store.toggleFeedTimer(running)
        }
        if type == .feed, editing == nil {
            let t = store.feedTimer
            leftMin = t.accLeft > 0 ? max(1, Int((t.accLeft / 60).rounded())) : 0
            rightMin = t.accRight > 0 ? max(1, Int((t.accRight / 60).rounded())) : 0
        }
        busy = true
        error = nil

        var new = NewEntry(babyId: baby.id, type: type, occurredAt: occurredAt, createdBy: userId)
        let trimmedNote = note.trimmingCharacters(in: .whitespacesAndNewlines)
        new.note = trimmedNote.isEmpty ? nil : trimmedNote

        switch type {
        case .nappy:
            new.wet = true
            new.dirty = dirty
            new.stoolColour = dirty ? stoolColour?.rawValue : nil
            new.nappyWeightG = Int(nappyWeightText.trimmingCharacters(in: .whitespaces))
        case .feed:
            new.leftMin = leftMin > 0 ? leftMin : nil
            new.rightMin = rightMin > 0 ? rightMin : nil
            new.expressedMl = expressedMl > 0 ? expressedMl : nil
            new.formulaMl = formulaMl > 0 ? formulaMl : nil
            let breast = leftMin + rightMin > 0
            let bottle = expressedMl + formulaMl > 0
            new.feedType = breast && bottle ? "mixed"
                : breast ? "breast"
                : expressedMl > 0 && formulaMl > 0 ? "mixed"
                : expressedMl > 0 ? "expressed" : "formula"
            if breast {
                new.endedAt = occurredAt.addingTimeInterval(TimeInterval((leftMin + rightMin) * 60))
            }
        case .sleep, .carerSleep:
            new.endedAt = sleepOngoing ? nil : sleepEnd
        case .weight:
            if let kg = Double(weightKgText.replacingOccurrences(of: ",", with: ".")) {
                new.weightG = Int(kg * 1000)
            }
            if let cm = Double(lengthCmText.replacingOccurrences(of: ",", with: ".")) {
                new.lengthMm = Int(cm * 10)
            }
            if let cm = Double(headCmText.replacingOccurrences(of: ",", with: ".")) {
                new.headCircMm = Int(cm * 10)
            }
        case .pump:
            new.expressedMl = pumpMl
        case .temperature:
            new.tempC = Double(tempText.replacingOccurrences(of: ",", with: "."))
        case .medication:
            new.medName = medName.trimmingCharacters(in: .whitespaces)
            new.medDose = medDose.isEmpty ? nil : medDose
            new.medKind = "dose"
            new.medSubject = medForMother ? "mother" : "baby"
        case .milestone:
            break
        }

        do {
            if var existing = editing {
                existing.occurredAt = new.occurredAt
                existing.note = new.note
                existing.wet = new.wet ?? existing.wet
                existing.dirty = new.dirty ?? existing.dirty
                if type == .nappy {
                    existing.stoolColour = new.stoolColour
                    existing.nappyWeightG = new.nappyWeightG
                }
                existing.lengthMm = new.lengthMm ?? existing.lengthMm
                existing.headCircMm = new.headCircMm ?? existing.headCircMm
                existing.leftMin = new.leftMin
                existing.rightMin = new.rightMin
                existing.expressedMl = new.expressedMl ?? (type == .pump ? pumpMl : nil)
                existing.formulaMl = new.formulaMl
                existing.feedType = new.feedType ?? existing.feedType
                existing.endedAt = type == .sleep || type == .carerSleep
                    ? (sleepOngoing ? nil : sleepEnd) : new.endedAt ?? existing.endedAt
                existing.weightG = new.weightG ?? existing.weightG
                existing.tempC = new.tempC ?? existing.tempC
                existing.medName = new.medName ?? existing.medName
                existing.medDose = new.medDose ?? existing.medDose
                try await store.update(existing)
            } else {
                try await store.save(new)
                if type == .feed { store.clearFeedTimer() }
            }
            dismiss()
        } catch {
            self.error = error.localizedDescription
        }
        busy = false
    }
}

// MARK: - Form controls

private struct BigChoice: View {
    let label: String
    let symbol: String
    let tint: Color
    let active: Bool
    let action: () -> Void

    var body: some View {
        Button {
            Haptics.tap()
            action()
        } label: {
            VStack(spacing: 6) {
                Image(systemName: symbol).font(.title3)
                Text(label).font(.system(.subheadline, design: .rounded, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(active ? tint.opacity(0.16) : Color.surfaceAlt, in: .rect(cornerRadius: 16))
            .overlay(
                RoundedRectangle(cornerRadius: 16)
                    .strokeBorder(active ? tint : Color.line, lineWidth: active ? 2 : 1)
            )
            .foregroundStyle(active ? tint : Color.muted)
        }
        .buttonStyle(.plain)
        .animation(.snappy(duration: 0.18), value: active)
    }
}

private struct MlStepper: View {
    let label: String
    @Binding var value: Int

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(label).font(.system(.body, design: .rounded, weight: .medium))
                Spacer()
                HStack(spacing: 0) {
                    Text("\(value)").font(.stat(22)).contentTransition(.numericText())
                    Text(" ml").font(.caption).foregroundStyle(Color.muted)
                }
            }
            HStack(spacing: 8) {
                ForEach([30, 60, 90], id: \.self) { amount in
                    Chip(label: "\(amount) ml", active: false) {
                        withAnimation(.snappy) { value += amount }
                    }
                }
                if value > 0 {
                    Chip(label: "Clear", active: false) {
                        withAnimation(.snappy) { value = 0 }
                    }
                }
            }
        }
    }
}
