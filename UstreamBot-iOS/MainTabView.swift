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
                    Image(systemName: "speedometer")
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
    @State private var serverStatus: String = "Checking..."
    @State private var isOnline: Bool = false
    @State private var lastChecked: Date?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(alignment: .leading, spacing: 16) {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Backend Status")
                            .font(.headline)

                        HStack {
                            Circle()
                                .fill(isOnline ? Color.green : Color.red)
                                .frame(width: 12, height: 12)

                            Text(serverStatus)
                                .foregroundColor(isOnline ? .green : .red)
                        }

                        if let lastChecked {
                            Text("Last checked \(lastChecked.formatted(date: .omitted, time: .shortened))")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(12)

                    VStack(alignment: .leading, spacing: 12) {
                        Text("User Communication")
                            .font(.headline)

                        Text("Open the Chat tab to send messages and receive backend responses.")
                            .foregroundColor(.secondary)
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(12)

                    Button("Refresh Dashboard") {
                        checkServerStatus()
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                }
                .padding()
            }
            .navigationTitle("Dashboard")
            .onAppear {
                checkServerStatus()
            }
        }
    }

    private func checkServerStatus() {
        serverStatus = "Checking..."
        lastChecked = Date()

        APIClient.healthCheck { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    serverStatus = "Online"
                    isOnline = true
                case .failure:
                    serverStatus = "Offline"
                    isOnline = false
                }
            }
        }
    }
}

struct SettingsView: View {
    @State private var serverStatus: String = "Checking..."
    @State private var isOnline: Bool = false
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                VStack(spacing: 10) {
                    Text("Server Status")
                        .font(.headline)
                    
                    HStack {
                        Circle()
                            .fill(isOnline ? Color.green : Color.red)
                            .frame(width: 12, height: 12)
                        
                        Text(serverStatus)
                            .foregroundColor(isOnline ? .green : .red)
                    }
                    
                    Button("Check Status") {
                        checkServerStatus()
                    }
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(8)
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)
                
                Spacer()
            }
            .padding()
            .navigationTitle("Settings")
            .onAppear {
                checkServerStatus()
            }
        }
    }
    
    private func checkServerStatus() {
        serverStatus = "Checking..."
        
        APIClient.healthCheck { result in
            DispatchQueue.main.async {
                switch result {
                case .success:
                    serverStatus = "Online"
                    isOnline = true
                case .failure:
                    serverStatus = "Offline"
                    isOnline = false
                }
            }
        }
    }
}
