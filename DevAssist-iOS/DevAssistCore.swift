import SwiftUI
import UIKit
import os.log

final class AppState: ObservableObject {
    @Published var isAuthenticated = false
    @Published var networkStatus: NetworkStatus = .unknown
    @Published var apiHealth: APIHealth = .unknown

    enum NetworkStatus {
        case connected, disconnected, unknown
    }

    enum APIHealth {
        case healthy, unhealthy, unknown
    }
}

final class AppDelegate: NSObject, UIApplicationDelegate {
    static let shared = AppDelegate()

    func configureApp() {
        configureLogging()
        NetworkMonitor.shared.startMonitoring()
        SecurityManager.shared.initialize()
    }

    private func configureLogging() {
        os_log("App launched successfully", log: .default, type: .info)
    }
}
