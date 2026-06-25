import Foundation

struct APIClient {
    private static let baseURL = "http://127.0.0.1:3000/api"

    private struct ChatRequest: Codable {
        let message: String
        let context: [ChatTurn]
    }

    private struct ChatTurn: Codable {
        let role: String
        let content: String
    }

    private struct ChatResponse: Codable {
        let response: String
    }
    
    static func sendMessage(prompt: String, completion: @escaping (Result<String, Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/chat") else {
            completion(.failure(APIError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30.0
        
        let requestBody = ChatRequest(message: prompt, context: [])
        
        do {
            let jsonData = try JSONEncoder().encode(requestBody)
            request.httpBody = jsonData
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(APIError.invalidResponse))
                    return
                }
                
                guard httpResponse.statusCode == 200 else {
                    completion(.failure(APIError.serverError(httpResponse.statusCode)))
                    return
                }
                
                guard let data = data else {
                    completion(.failure(APIError.noData))
                    return
                }
                
                do {
                    let response = try JSONDecoder().decode(ChatResponse.self, from: data)
                    completion(.success(response.response))
                } catch {
                    completion(.failure(error))
                }
            }
        }.resume()
    }
    
    // Health check endpoint
    static func healthCheck(completion: @escaping (Result<Bool, Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/health") else {
            completion(.failure(APIError.invalidURL))
            return
        }
        
        URLSession.shared.dataTask(with: URLRequest(url: url)) { _, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }
                
                if let httpResponse = response as? HTTPURLResponse,
                   httpResponse.statusCode == 200 {
                    completion(.success(true))
                } else {
                    completion(.failure(APIError.serverUnavailable))
                }
            }
        }.resume()
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case noData
    case serverError(Int)
    case serverUnavailable
    case invalidResponseFormat
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .invalidResponse:
            return "Invalid server response"
        case .noData:
            return "No data received"
        case .serverError(let code):
            return "Server error (Code: \(code))"
        case .serverUnavailable:
            return "Server unavailable"
        case .invalidResponseFormat:
            return "Invalid response format"
        }
    }
}
