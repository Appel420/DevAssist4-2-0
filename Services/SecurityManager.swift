import Foundation
import CryptoKit
import os.log

class SecurityManager {
    static let shared = SecurityManager()
    
    private let logger = Logger(subsystem: "com.devassist.app", category: "Security")
    
    private init() {}
    
    func initialize() {
        logger.info("Security manager initialized")
    }
    
    // MARK: - Input Sanitization
    func sanitizeInput(_ input: String) -> String {
        // Remove potentially dangerous characters
        let allowedCharacters = CharacterSet.alphanumerics
            .union(.whitespaces)
            .union(.punctuationCharacters)
            .union(.symbols)
        
        let sanitized = input.components(separatedBy: allowedCharacters.inverted).joined()
        
        // Limit length to prevent abuse
        let maxLength = 1000
        let trimmed = String(sanitized.prefix(maxLength))
        
        return trimmed.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    func sanitizeOutput(_ output: String) -> String {
        // Basic output sanitization
        return output.trimmingCharacters(in: .whitespacesAndNewlines)
    }
    
    // MARK: - Data Validation
    func validateAPIKey(_ key: String) -> Bool {
        // Basic API key validation
        return !key.isEmpty && key.count >= 10
    }
    
    func validateURL(_ urlString: String) -> Bool {
        guard let url = URL(string: urlString) else { return false }
        if url.scheme == "https" {
            return true
        }

        let localHosts = ["localhost", "127.0.0.1", "::1"]
        return url.scheme == "http" && localHosts.contains(url.host ?? "")
    }
    
    // MARK: - Encryption Helpers
    func generateSecureToken() -> String {
        let data = Data((0..<32).map { _ in UInt8.random(in: 0...255) })
        return data.base64EncodedString()
    }
}
