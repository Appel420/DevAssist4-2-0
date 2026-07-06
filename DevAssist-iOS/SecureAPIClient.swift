import Foundation
import CryptoKit
import os.log

class SecureAPIClient {
    static let shared = SecureAPIClient()
    
    private let session: URLSession
    private let logger = Logger(subsystem: "com.devassist.app", category: "API")
    private let keychain = KeychainManager.shared
    
    // NEVER hardcode API URLs or keys - use configuration
    private var baseURL: String {
        return Configuration.shared.apiBaseURL
    }
    
    private init() {
        // Configure secure URLSession
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 30.0
        configuration.timeoutIntervalForResource = 60.0
        configuration.waitsForConnectivity = true
        configuration.httpMaximumConnectionsPerHost = 2
        
        // Security headers
        configuration.httpAdditionalHeaders = [
            "User-Agent": "DevAssist-iOS/4.2.0",
            "Accept": "application/json",
            "Content-Type": "application/json"
        ]
        
        self.session = URLSession(configuration: configuration)
    }
    
    func sendChatMessage(_ message: String) async throws -> String {
        guard let url = URL(string: "\(baseURL)/chat") else {
            throw APIError.invalidURL
        }
        
        // Create secure request
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        // Add authentication if available
        if let apiKey = keychain.getAPIKey() {
            request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        }
        
        // Create request body with input validation
        let requestBody = ChatRequest(
            message: SecurityManager.shared.sanitizeInput(message),
            timestamp: Date().timeIntervalSince1970,
            deviceId: await DeviceManager.shared.getSecureDeviceId()
        )
        
        do {
            request.httpBody = try JSONEncoder().encode(requestBody)
        } catch {
            logger.error("Failed to encode request: \(error.localizedDescription)")
            throw APIError.encodingError
        }
        
        // Make secure request
        do {
            let (data, response) = try await session.data(for: request)
            
            // Validate response
            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.invalidResponse
            }
            
            // Handle different status codes
            switch httpResponse.statusCode {
            case 200:
                break
            case 401:
                throw APIError.unauthorized
            case 429:
                throw APIError.rateLimited
            case 500...599:
                throw APIError.serverError
            default:
                throw APIError.httpError(httpResponse.statusCode)
            }
            
            // Parse response
            let chatResponse = try JSONDecoder().decode(ChatResponse.self, from: data)
            
            // Validate and sanitize response
            let sanitizedResponse = SecurityManager.shared.sanitizeOutput(chatResponse.message)
            
            logger.info("Chat API request successful")
            return sanitizedResponse
            
        } catch {
            logger.error("Chat API request failed: \(error.localizedDescription)")
            throw error
        }
    }
    
    func healthCheck() async throws -> Bool {
        guard let url = URL(string: "\(baseURL)/health") else {
            throw APIError.invalidURL
        }
        
        let request = URLRequest(url: url)
        
        do {
            let (_, response) = try await session.data(for: request)
            
            if let httpResponse = response as? HTTPURLResponse {
                return httpResponse.statusCode == 200
            }
            
            return false
            
        } catch {
            logger.error("Health check failed: \(error.localizedDescription)")
            return false
        }
    }
}

// MARK: - API Models
private struct ChatRequest: Codable {
    let message: String
    let timestamp: TimeInterval
    let deviceId: String
}

private struct ChatResponse: Codable {
    let message: String
    let timestamp: TimeInterval
}

enum APIError: LocalizedError {
    case invalidURL
    case encodingError
    case invalidResponse
    case unauthorized
    case rateLimited
    case serverError
    case httpError(Int)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid API URL"
        case .encodingError:
            return "Request encoding failed"
        case .invalidResponse:
            return "Invalid server response"
        case .unauthorized:
            return "Authentication required"
        case .rateLimited:
            return "Rate limit exceeded"
        case .serverError:
            return "Server error"
        case .httpError(let code):
            return "HTTP error: \(code)"
        }
    }
}

