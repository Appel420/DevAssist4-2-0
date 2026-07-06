import SwiftUI

@main
struct DevAssist4_2_0App: App {
    @StateObject private var appState = AppState()
    
    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(appState)
                .onAppear {
                    AppDelegate.shared.configureApp()
                }
        }
    }
}
