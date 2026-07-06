import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            ContentView()
                .tabItem {
                    Image(systemName: "message")
                    Text("Chat")
                }

            DashboardView()
                .tabItem {
                    Image(systemName: "shield.lefthalf.filled")
                    Text("Dashboard")
                }

            SettingsView()
                .tabItem {
                    Image(systemName: "gear")
                    Text("Settings")
                }
        }
    }
}

struct DashboardView: View {
    @State private var report: SecurityReport?
    @State private var statusMessage = "Loading live security report..."
    @State private var isLoading = false

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    transparencyCard
                    modelCard
                    usageCard

                    Button(isLoading ? "Refreshing..." : "Refresh Report") {
                        loadReport()
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                    .disabled(isLoading)
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .onAppear {
                loadReport()
            }
        }
    }

    private var transparencyCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Live Security Report")
                .font(.headline)

            Text(statusMessage)
                .font(.subheadline)
                .foregroundColor(.secondary)

            if let report {
                Label(report.localOnly ? "Local-only runtime enabled" : "Hybrid runtime enabled", systemImage: "lock.fill")
                Text("Mode: \(report.runtimeMode)")
                Text("Max tokens: \(report.maxTokens)")
                Text("Memory entries: \(report.memory.count)")
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    private var modelCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Active Model")
                .font(.headline)

            if let report {
                Text(report.selectedModel.label)
                    .font(.title3)
                    .fontWeight(.semibold)
                Text("Model ID: \(report.selectedModel.id)")
                    .foregroundColor(.secondary)

                ForEach(report.supportedModels) { model in
                    HStack {
                        Text(model.label)
                        Spacer()
                        Text(model.supportsVision ? "VLM" : "LLM")
                            .foregroundColor(.secondary)
                    }
                    .font(.caption)
                }
            } else {
                Text("No model data available.")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    private var usageCard: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Usage")
                .font(.headline)

            if let report {
                Text("Requests: \(report.usage.requests)")
                Text("Rate-limited: \(report.usage.rateLimitedResponses)")

                if report.usage.alerts.isEmpty {
                    Text("No active alerts.")
                        .foregroundColor(.secondary)
                } else {
                    ForEach(report.usage.alerts, id: \.self) { alert in
                        Text("• \(alert)")
                    }
                }
            } else {
                Text("Usage is unavailable.")
                    .foregroundColor(.secondary)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(12)
    }

    private func loadReport() {
        isLoading = true
        statusMessage = "Loading live security report..."

        APIClient.fetchSecurityReport { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let report):
                    self.report = report
                    statusMessage = "Security report updated at \(Date().formatted(date: .omitted, time: .standard))"
                case .failure(let error):
                    statusMessage = error.localizedDescription
                }
            }
        }
    }
}

struct SettingsView: View {
    @State private var report: SecurityReport?
    @State private var memoryEntries: [MemoryEntry] = []
    @State private var selectedMode: RuntimeMode = .offline
    @State private var selectedModelId = ""
    @State private var maxTokens = 2048
    @State private var newMemoryContent = ""
    @State private var newMemoryKind = "text"
    @State private var statusMessage = "Loading live settings..."
    @State private var isLoading = false
    @State private var isSyncing = false

    private let memoryKinds = ["text", "voice", "model"]

    var body: some View {
        NavigationView {
            Form {
                Section("Runtime Mode") {
                    Picker("Mode", selection: $selectedMode) {
                        ForEach(RuntimeMode.allCases, id: \.self) { mode in
                            Text(mode.rawValue.capitalized).tag(mode)
                        }
                    }
                    .onChange(of: selectedMode) { newValue in
                        guard !isSyncing else { return }
                        applyRuntimeMode(newValue)
                    }
                }

                Section("Model Selection") {
                    Picker("Model", selection: $selectedModelId) {
                        if let report {
                            ForEach(report.supportedModels) { model in
                                Text(model.label).tag(model.id)
                            }
                        }
                    }
                    .onChange(of: selectedModelId) { newValue in
                        guard !isSyncing else { return }
                        guard !newValue.isEmpty else { return }
                        applyModel(newValue)
                    }
                }

                Section("Token Budget") {
                    Stepper("Max Tokens: \(maxTokens)", value: $maxTokens, in: 1...8192, step: 128)
                        .onChange(of: maxTokens) { newValue in
                            guard !isSyncing else { return }
                            applyMaxTokens(newValue)
                        }
                }

                Section("Persistent Memory") {
                    Picker("Kind", selection: $newMemoryKind) {
                        ForEach(memoryKinds, id: \.self) { kind in
                            Text(kind.capitalized).tag(kind)
                        }
                    }

                    TextEditor(text: $newMemoryContent)
                        .frame(minHeight: 80)

                    Button("Add Memory") {
                        addMemory()
                    }
                    .disabled(newMemoryContent.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                    if let report {
                        Text(report.memory.deleteGateEnabled ? "Deletion gate: enabled" : "Deletion gate: disabled")
                            .font(.caption)
                            .foregroundColor(.secondary)
                    }

                    ForEach(memoryEntries) { entry in
                        VStack(alignment: .leading, spacing: 6) {
                            Text(entry.content)
                            Text("\(entry.kind.capitalized) • \(entry.author) • \(entry.createdAt)")
                                .font(.caption)
                                .foregroundColor(.secondary)

                            Button("Delete Memory") {
                                deleteMemory(entry)
                            }
                            .foregroundColor(.red)
                        }
                    }
                }

                Section("Status") {
                    Text(statusMessage)
                        .foregroundColor(.secondary)
                }
            }
            .navigationTitle("Settings")
            .onAppear {
                loadSettings()
            }
        }
    }

    private func loadSettings() {
        isLoading = true
        isSyncing = true
        statusMessage = "Loading live settings..."

        APIClient.fetchSecurityReport { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let report):
                    self.report = report
                    self.selectedMode = RuntimeMode(rawValue: report.runtimeMode) ?? .offline
                    self.selectedModelId = report.selectedModel.id
                    self.maxTokens = report.maxTokens
                    self.statusMessage = "Live settings loaded."
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }

                isSyncing = false
                loadMemory()
            }
        }
    }

    private func loadMemory() {
        APIClient.fetchMemory { result in
            DispatchQueue.main.async {
                isLoading = false
                switch result {
                case .success(let memory):
                    self.memoryEntries = memory
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func applyRuntimeMode(_ mode: RuntimeMode) {
        APIClient.setRuntimeMode(mode) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let runtimeMode):
                    self.isSyncing = true
                    self.selectedMode = runtimeMode
                    self.isSyncing = false
                    loadSettings()
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func applyModel(_ modelId: String) {
        APIClient.selectModel(modelId) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let model):
                    self.isSyncing = true
                    self.selectedModelId = model.id
                    self.isSyncing = false
                    loadSettings()
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func applyMaxTokens(_ value: Int) {
        APIClient.setMaxTokens(value) { result in
            DispatchQueue.main.async {
                switch result {
                case .success(let tokens):
                    self.isSyncing = true
                    self.maxTokens = tokens
                    self.isSyncing = false
                    loadSettings()
                case .failure(let error):
                    self.statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func addMemory() {
        let content = newMemoryContent.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !content.isEmpty else { return }

        APIClient.addMemory(content, kind: newMemoryKind) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    newMemoryContent = ""
                    loadMemory()
                case .failure(let error):
                    statusMessage = error.localizedDescription
                }
            }
        }
    }

    private func deleteMemory(_ entry: MemoryEntry) {
        APIClient.deleteMemory(id: entry.id, confirmDelete: true, signature: entry.signature) { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    loadMemory()
                case .failure(let error):
                    statusMessage = error.localizedDescription
                }
            }
        }
    }
}
