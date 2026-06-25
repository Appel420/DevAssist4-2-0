import Foundation

class Configuration {
    static let shared = Configuration()
    
    private init() {}
    
    // MARK: - API Configuration
    var apiBaseURL: String {
        #if DEBUG
        return "http://127.0.0.1:3000/api/v1"
        #else
        return "http://127.0.0.1:3000/api/v1"
        #endif
    }

    var localOnlyMode: Bool { true }
    
    var appleAppId: String {
        return Bundle.main.object(forInfoDictionaryKey: "APPLE_APP_ID") as? String ?? ""
    }
    
    // MARK: - Feature Flags
    var isAnalyticsEnabled: Bool {
        #if DEBUG
        return false
        #else
        return false
        #endif
    }
    
    var isCrashReportingEnabled: Bool {
        #if DEBUG
        return false
        #else
        return false
        #endif
    }
}
