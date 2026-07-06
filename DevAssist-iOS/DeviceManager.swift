import UIKit
import os.log

class DeviceManager {
    static let shared = DeviceManager()
    
    private let logger = Logger(subsystem: "com.devassist.app", category: "Device")
    private let userDefaults = UserDefaults.standard
    
    private init() {}
    
    func getSecureDeviceId() async -> String {
        // Use identifierForVendor (Apple approved method)
        if let vendorId = await UIDevice.current.identifierForVendor?.uuidString {
            return vendorId
        }
        
        // Fallback to stored UUID
        if let storedId = userDefaults.string(forKey: "device_id") {
            return storedId
        }
        
        // Generate new UUID
        let newId = UUID().uuidString
        userDefaults.set(newId, forKey: "device_id")
        
        logger.info("Generated new device ID")
        return newId
    }
    
    var deviceInfo: [String: String] {
        return [
            "model": UIDevice.current.model,
            "systemName": UIDevice.current.systemName,
            "systemVersion": UIDevice.current.systemVersion,
            "appVersion": Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "Unknown"
        ]
    }
}

