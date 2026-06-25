import Foundation

class Configuration {
    static let shared = Configuration()
    
    private init() {}
    
    // MARK: - API Configuration
    var apiBaseURL: String {
        if let override = ProcessInfo.processInfo.environment["DEVASSIST_API_BASE_URL"],
           !override.isEmpty {
            return override
        }

        if let plistValue = Bundle.main.object(forInfoDictionaryKey: "DEVASSIST_API_BASE_URL") as? String,
           !plistValue.isEmpty {
            return plistValue
        }

        return ""
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
