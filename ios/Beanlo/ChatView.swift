import SwiftUI

/// Ask Bea — streams answers from the same /api/chat backend as the web,
/// with shared saved conversations (chat_conversations / chat_messages).
struct ChatView: View {
    @EnvironmentObject private var store: Store
    @StateObject private var chat = ChatStore()
    @State private var input = ""
    @State private var showConversations = false
    @FocusState private var focused: Bool

    var body: some View {
        Group {
            if !store.aiEnabled {
                paywall
            } else {
                conversation
            }
        }
        .background(Color.sand)
        .navigationTitle("Ask Bea")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if store.aiEnabled {
                ToolbarItem(placement: .topBarLeading) {
                    Button {
                        showConversations = true
                    } label: {
                        Label("Chats (\(chat.conversations.count))", systemImage: "clock")
                            .font(.caption)
                    }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("New") {
                        chat.startNew()
                    }
                    .disabled(chat.messages.isEmpty)
                }
            }
        }
        .sheet(isPresented: $showConversations) {
            ConversationsSheet(chat: chat)
                .presentationDetents([.medium, .large])
                .presentationBackground(Color.sand)
        }
        .task {
            // The floating + and timer pill would sit on the message input.
            store.chatThreadOpen = true
            chat.configure(store: store)
            await chat.loadConversations()
        }
        .onDisappear { store.chatThreadOpen = false }
    }

    private var paywall: some View {
        VStack(spacing: 12) {
            Image(systemName: "sparkles").font(.largeTitle).foregroundStyle(Color.accent)
            Text("Bea is part of Advanced")
                .font(.system(.headline, design: .rounded))
            Text("Ask anything about what you've logged — weight trends, feeding patterns, last night's stretches. Upgrades are coming soon.")
                .font(.subheadline)
                .foregroundStyle(Color.muted)
                .multilineTextAlignment(.center)
        }
        .padding(28)
    }

    private var conversation: some View {
        VStack(spacing: 0) {
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        if chat.messages.isEmpty {
                            emptyState
                        }
                        ForEach(chat.messages.indices, id: \.self) { i in
                            bubble(chat.messages[i], index: i)
                        }
                        if chat.streaming && chat.messages.last?.role != "assistant" {
                            typingDots
                        }
                        Color.clear.frame(height: 4).id("bottom")
                    }
                    .padding(16)
                }
                .onChange(of: chat.messages.last?.content) {
                    proxy.scrollTo("bottom", anchor: .bottom)
                }
            }

            HStack(spacing: 10) {
                TextField("Ask about \(store.baby?.name ?? "your baby")…", text: $input, axis: .vertical)
                    .lineLimit(1...4)
                    .focused($focused)
                    .padding(.horizontal, 16)
                    .padding(.vertical, 11)
                    .glassEffect(.regular, in: .capsule)
                Button {
                    send()
                } label: {
                    Image(systemName: "arrow.up")
                        .font(.body.weight(.bold))
                        .foregroundStyle(Color.onInk)
                        .frame(width: 40, height: 40)
                        .background(input.trimmingCharacters(in: .whitespaces).isEmpty ? Color.faint : Color.ink, in: .circle)
                }
                .disabled(input.trimmingCharacters(in: .whitespaces).isEmpty || chat.streaming)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)

            Text("Bea is a tracking aid, not medical advice.")
                .font(.caption2)
                .foregroundStyle(Color.faint)
                .padding(.bottom, 6)
        }
    }

    private var emptyState: some View {
        VStack(alignment: .leading, spacing: 14) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Ask Bea about \(store.baby?.name ?? "your baby")")
                    .font(.system(.title3, design: .rounded, weight: .bold))
                Text("Answers come only from what you've logged. Chats are shared with everyone caring for \(store.baby?.name ?? "your baby").")
                    .font(.subheadline)
                    .foregroundStyle(Color.muted)
            }
            ForEach([
                "Is their weight on track?",
                "How does this week's formula compare to last week?",
                "What was the longest stretch between feeds last night?",
                "Summarise the last 24 hours",
            ], id: \.self) { starter in
                Button {
                    input = starter
                    send()
                } label: {
                    Text(starter)
                        .font(.system(.subheadline, design: .rounded, weight: .medium))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.surface, in: .rect(cornerRadius: 16))
                        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(Color.line, lineWidth: 1))
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.top, 12)
    }

    @ViewBuilder
    private func bubble(_ message: ChatMessage, index: Int) -> some View {
        if message.role == "user" {
            HStack {
                Spacer(minLength: 48)
                Text(message.content)
                    .font(.system(.subheadline, design: .rounded))
                    .foregroundStyle(Color.onInk)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Color.ink, in: .rect(cornerRadius: 18))
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text(LocalizedStringKey(message.content))
                    .font(.system(.subheadline, design: .rounded))
                    .textSelection(.enabled)
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.surface, in: .rect(cornerRadius: 18))
                if message.id != nil {
                    HStack(spacing: 10) {
                        Text("Helpful?").font(.caption2).foregroundStyle(Color.faint)
                        feedbackButton(message, index: index, value: "up", symbol: "hand.thumbsup")
                        feedbackButton(message, index: index, value: "down", symbol: "hand.thumbsdown")
                    }
                    .padding(.leading, 6)
                }
            }
        }
    }

    private func feedbackButton(_ message: ChatMessage, index: Int, value: String, symbol: String) -> some View {
        Button {
            Task { await chat.setFeedback(index: index, value: value) }
        } label: {
            Image(systemName: message.feedback == value ? symbol + ".fill" : symbol)
                .font(.caption)
                .foregroundStyle(message.feedback == value ? Color.accent : Color.faint)
        }
    }

    private var typingDots: some View {
        HStack(spacing: 4) {
            ForEach(0..<3, id: \.self) { i in
                Circle()
                    .fill(Color.muted)
                    .frame(width: 6, height: 6)
                    .opacity(0.4)
                    .phaseAnimator([0.3, 1.0]) { view, phase in
                        view.opacity(phase)
                    } animation: { _ in .easeInOut(duration: 0.5).delay(Double(i) * 0.15) }
            }
        }
        .padding(14)
        .background(Color.surface, in: .rect(cornerRadius: 18))
    }

    private func send() {
        let text = input.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty else { return }
        input = ""
        Haptics.tap()
        Task { await chat.send(text) }
    }
}

private struct ConversationsSheet: View {
    @ObservedObject var chat: ChatStore
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            List {
                Button {
                    chat.startNew()
                    dismiss()
                } label: {
                    Label("New chat", systemImage: "plus")
                        .font(.system(.body, design: .rounded, weight: .semibold))
                }
                .listRowBackground(Color.surface)

                ForEach(chat.conversations) { convo in
                    Button {
                        Task { await chat.open(convo) }
                        dismiss()
                    } label: {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(convo.title ?? "Chat")
                                .font(.system(.subheadline, design: .rounded, weight: .medium))
                                .foregroundStyle(Color.ink)
                                .lineLimit(1)
                            Text(convo.createdAt.formatted(.relative(presentation: .named)))
                                .font(.caption2)
                                .foregroundStyle(Color.muted)
                        }
                    }
                    .listRowBackground(chat.activeConversation?.id == convo.id ? Color.accentSoft : Color.surface)
                    .swipeActions {
                        Button(role: .destructive) {
                            Task { await chat.deleteConversation(convo) }
                        } label: {
                            Label("Delete", systemImage: "trash")
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.sand)
            .navigationTitle("Chats")
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

// MARK: - Chat store

@MainActor
final class ChatStore: ObservableObject {
    @Published var conversations: [ChatConversation] = []
    @Published var activeConversation: ChatConversation?
    @Published var messages: [ChatMessage] = []
    @Published var streaming = false

    private weak var store: Store?
    private var streamTask: Task<Void, Never>?

    func configure(store: Store) {
        self.store = store
    }

    func loadConversations() async {
        guard let store, let baby = store.baby else { return }
        conversations = (try? await store.supabase
            .from("chat_conversations")
            .select("id, title, created_at")
            .eq("baby_id", value: baby.id)
            .order("updated_at", ascending: false)
            .execute().value) ?? []
    }

    func startNew() {
        streamTask?.cancel()
        streaming = false
        activeConversation = nil
        messages = []
    }

    func open(_ convo: ChatConversation) async {
        guard let store else { return }
        streamTask?.cancel()
        streaming = false
        activeConversation = convo
        messages = (try? await store.supabase
            .from("chat_messages")
            .select("id, role, content, feedback")
            .eq("conversation_id", value: convo.id)
            .order("created_at", ascending: true)
            .execute().value) ?? []
    }

    func deleteConversation(_ convo: ChatConversation) async {
        guard let store else { return }
        try? await store.supabase.from("chat_conversations").delete().eq("id", value: convo.id).execute()
        conversations.removeAll { $0.id == convo.id }
        if activeConversation?.id == convo.id { startNew() }
    }

    func setFeedback(index: Int, value: String) async {
        guard let store, messages.indices.contains(index), let id = messages[index].id else { return }
        let next: String? = messages[index].feedback == value ? nil : value
        messages[index].feedback = next
        struct F: Encodable { let feedback: String? }
        _ = try? await store.supabase.from("chat_messages")
            .update(F(feedback: next))
            .eq("id", value: id)
            .execute()
        Haptics.tap()
    }

    func send(_ text: String) async {
        guard let store else { return }
        messages.append(ChatMessage(role: "user", content: text))
        streaming = true

        // Ensure a conversation row exists, then persist the user turn.
        if activeConversation == nil, let baby = store.baby, let userId = store.userId {
            struct NewConvo: Encodable {
                let baby_id: UUID
                let title: String
                let created_by: UUID
            }
            activeConversation = try? await store.supabase
                .from("chat_conversations")
                .insert(NewConvo(baby_id: baby.id, title: String(text.prefix(70)), created_by: userId))
                .select("id, title, created_at")
                .single()
                .execute().value
            if let c = activeConversation { conversations.insert(c, at: 0) }
        }
        await persist(role: "user", content: text, index: messages.count - 1)

        streamTask = Task {
            do {
                let body: [String: Any] = [
                    "messages": messages.map { ["role": $0.role, "content": $0.content] },
                    "tz": TimeZone.current.identifier,
                ]
                let request = try await store.apiRequest("/api/chat", body: body)
                let (bytes, response) = try await URLSession.shared.bytes(for: request)
                let http = response as? HTTPURLResponse
                // A redirect to the login page returns 200 with HTML —
                // never stream that into the chat.
                guard http?.statusCode == 200,
                      http?.value(forHTTPHeaderField: "Content-Type")?.contains("text/html") != true else {
                    throw URLError(.badServerResponse)
                }
                messages.append(ChatMessage(role: "assistant", content: ""))
                let answerIndex = messages.count - 1
                for try await line in bytes.lines {
                    if Task.isCancelled { return }
                    messages[answerIndex].content += messages[answerIndex].content.isEmpty ? line : "\n" + line
                }
                await persist(role: "assistant", content: messages[answerIndex].content, index: answerIndex)
            } catch {
                if messages.last?.role != "assistant" || messages.last?.content.isEmpty == true {
                    if messages.last?.role == "assistant" { messages.removeLast() }
                    messages.append(ChatMessage(role: "assistant", content: "Something went wrong — try again in a moment."))
                }
            }
            streaming = false
        }
        await streamTask?.value
    }

    private func persist(role: String, content: String, index: Int) async {
        guard let store, let convo = activeConversation, !content.isEmpty else { return }
        struct NewMsg: Encodable {
            let conversation_id: UUID
            let role: String
            let content: String
        }
        struct Row: Decodable { let id: UUID }
        if let row: Row = try? await store.supabase
            .from("chat_messages")
            .insert(NewMsg(conversation_id: convo.id, role: role, content: content))
            .select("id")
            .single()
            .execute().value,
           messages.indices.contains(index) {
            messages[index].id = row.id
        }
    }
}
