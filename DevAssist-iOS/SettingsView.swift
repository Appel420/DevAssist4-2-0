import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var appState: AppState
    @Environment(\.dismiss) private var dismiss
    @State private var apiKey = ""
    @State private var showingAPIKeyAlert = false
    @State private var showingPrivacyPolicy = false
    
    var body: some View {
        NavigationView {
            Form {
                Section("API Configuration") {
                    SecureField("API Key", text: $apiKey)
                        .textContentType(.password)
                    
                    Button("Save API Key") {
                        saveAPIKey()
                    }
                    .disabled(apiKey.isEmpty)
                }
                
                Section("Privacy & Security") {
                    Button("View Privacy Policy") {
                        showingPrivacyPolicy = true
                    }
                    
                    Button("Clear All Data") {
                        clearAllData()
                    }
                    .foregroundColor(.red)
                }
                
                Section("App Information") {
                    HStack {
                        Text("Version")
                        Spacer()
                        Text("4.2.0")
                            .foregroundColor(.secondary)
                    }
                    
                    HStack {
                        Text("Build")
                        Spacer()
                        Text(Bundle.main.infoDictionary?["CFBundleVersion"] as? String ?? "Unknown")
                            .foregroundColor(.secondary)
                    }
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .alert("API Key Saved", isPresented: $showingAPIKeyAlert) {
                Button("OK") { }
            } message: {
                Text("Your API key has been securely saved.")
            }
            .sheet(isPresented: $showingPrivacyPolicy) {
                PrivacyPolicyView()
            }
        }
        .onAppear {
            loadAPIKey()
        }
    }
    
    private func saveAPIKey() {
        if KeychainManager.shared.saveAPIKey(apiKey) {
            showingAPIKeyAlert = true
            apiKey = ""
        }
    }
    
    private func loadAPIKey() {
        // Don't show the actual key for security
        if KeychainManager.shared.getAPIKey() != nil {
            apiKey = "••••••••••••"
        }
    }
    
    private func clearAllData() {
        KeychainManager.shared.deleteAPIKey()
        // Clear other sensitive data
        UserDefaults.standard.removeObject(forKey: "device_id")
    }
}

struct PrivacyPolicyView: View {
    @Environment(\.dismiss) private var dismiss
    
    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    Text("Privacy Policy")
                        .font(.largeTitle)
                        .fontWeight(.bold)
                    
                    Text("Last updated: \(Date().formatted(date: .abbreviated, time: .omitted))")
                        .foregroundColor(.secondary)
                    
                    Group {
                        Text("Data Collection")
                            .font(.headline)
                        
                        Text("We collect only the minimum data necessary to provide our services. This includes:")
                        
                        Text("• Messages you send to the chatbot\n• Device information for analytics\n• Usage patterns to improve the app")
                    }
                    
                    Group {
                        Text("Data Security")
                            .font(.headline)
                        
                        Text("Your data is protected using industry-standard encryption. API keys and OAuth tokens are stored securely in the iOS Keychain.")
                    }
                    
                    Group {
                        Text("Third-Party Services")
                            .font(.headline)
                        
                        Text("This app may use third-party services that have their own privacy policies. We recommend reviewing their policies as well.")
                    }
                    
                    Spacer()
                }
                .padding()
            }
            .navigationTitle("Privacy Policy")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
        }
    }
}
