import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct ChatRequest: Codable {
    let message: String
    let context: [ChatTurn]
}

struct ChatTurn: Codable {
    let role: String
    let content: String
}

struct ChatResponse: Decodable {
    let response: String

    enum CodingKeys: String, CodingKey {
        case response
        case message
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        response = try container.decodeIfPresent(String.self, forKey: .response)
            ?? container.decode(String.self, forKey: .message)
    }
}

class APIClient {
    private static var baseURL: String {
        Configuration.shared.apiBaseURL
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
        
        let chatRequest = ChatRequest(message: prompt, context: [])
        
        do {
            let jsonData = try JSONEncoder().encode(chatRequest)
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
                    let errorMessage = String(data: data ?? Data(), encoding: .utf8) ?? "Unknown error"
                    completion(.failure(APIError.serverError(httpResponse.statusCode, errorMessage)))
                    return
                }
                
                guard let data = data else {
                    completion(.failure(APIError.noData))
                    return
                }
                
                do {
                    let chatResponse = try JSONDecoder().decode(ChatResponse.self, from: data)
                    completion(.success(chatResponse.response))
                } catch {
                    completion(.failure(error))
                }
            }
        }.resume()
    }
    
    static func healthCheck(completion: @escaping (Result<Bool, Error>) -> Void) {
        guard let url = URL(string: "\(baseURL)/health") else {
            completion(.failure(APIError.invalidURL))
            return
        }
        
        URLSession.shared.dataTask(with: URLRequest(url: url)) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }
                
                guard let httpResponse = response as? HTTPURLResponse,
                      httpResponse.statusCode == 200 else {
                    completion(.failure(APIError.serverUnavailable))
                    return
                }
                
                completion(.success(true))
            }
        }.resume()
    }
}

enum APIError: LocalizedError {
    case invalidURL
    case invalidResponse
    case noData
    case serverError(Int, String)
    case serverUnavailable
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .invalidResponse:
            return "Invalid server response"
        case .noData:
            return "No data received from server"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        case .serverUnavailable:
            return "Server is currently unavailable"
        }
    }
}
