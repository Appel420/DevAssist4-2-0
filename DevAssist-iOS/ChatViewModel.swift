import Foundation
import Combine
import os.log

@MainActor
class ChatViewModel: ObservableObject {
    @Published var messages: [ChatMessage] = []
    @Published var isLoading = false
    @Published var error: ChatError?
    
    private let apiClient = SecureAPIClient.shared
    private let logger = Logger(subsystem: "com.devassist.app", category: "Chat")
    private var cancellables = Set<AnyCancellable>()
    
    func initialize() async {
        // Add welcome message
        let welcomeMessage = ChatMessage(
            text: "Hello! I'm DevAssist 4.2.0. I'm here to help you with your development questions while keeping your data secure and private.",
            isUser: false
        )
        messages.append(welcomeMessage)
        
        // Check API health
        await checkAPIHealth()
    }
    
    func sendMessage(_ text: String) async {
        // Input validation and sanitization
        let sanitizedText = SecurityManager.shared.sanitizeInput(text)
        guard !sanitizedText.isEmpty else { return }
        
        // Add user message
        let userMessage = ChatMessage(text: sanitizedText, isUser: true)
        messages.append(userMessage)
        
        // Set loading state
        isLoading = true
        error = nil
        
        do {
            // Send to API with security measures
            let response = try await apiClient.sendChatMessage(sanitizedText)
            
            // Add bot response
            let botMessage = ChatMessage(text: response, isUser: false)
            messages.append(botMessage)
            
            logger.info("Chat message sent successfully")
            
        } catch {
            logger.error("Chat error: \(error.localizedDescription)")
            
            let errorMessage = ChatMessage(
                text: "I apologize, but I'm having trouble connecting right now. Please try again in a moment.",
                isUser: false
            )
            messages.append(errorMessage)
            
            self.error = error as? ChatError ?? .unknown
        }
        
        isLoading = false
    }
    
    private func checkAPIHealth() async {
        do {
            let isHealthy = try await apiClient.healthCheck()
            logger.info("API health check: \(isHealthy ? "healthy" : "unhealthy")")
        } catch {
            logger.error("API health check failed: \(error.localizedDescription)")
        }
    }
}

// MARK: - Chat Models
struct ChatMessage: Identifiable, Codable {
    let id = UUID()
    let text: String
    let isUser: Bool
    let timestamp = Date()
}

enum ChatError: LocalizedError {
    case networkError
    case invalidResponse
    case rateLimited
    case unauthorized
    case serverError
    case unknown
    
    var errorDescription: String? {
        switch self {
        case .networkError:
            return "Network connection error"
        case .invalidResponse:
            return "Invalid server response"
        case .rateLimited:
            return "Too many requests. Please wait."
        case .unauthorized:
            return "Authentication required"
        case .serverError:
            return "Server error occurred"
        case .unknown:
            return "An unknown error occurred"
        }
    }
}
