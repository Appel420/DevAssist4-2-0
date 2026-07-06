import Foundation
#if canImport(FoundationNetworking)
import FoundationNetworking
#endif

struct ChatRequest: Codable {
    let message: String
    let context: [ChatTurn]
    let maxTokens: Int?
    let modelId: String?
    let runtimeMode: RuntimeMode?
}

struct ChatTurn: Codable {
    let role: String
    let content: String
}

struct ChatResponse: Decodable {
    let response: String
    let model: String?
    let runtimeMode: String?
    let maxTokens: Int?

    enum CodingKeys: String, CodingKey {
        case response
        case message
        case model
        case runtimeMode
        case maxTokens
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        response = try container.decodeIfPresent(String.self, forKey: .response)
            ?? container.decode(String.self, forKey: .message)
        model = try container.decodeIfPresent(String.self, forKey: .model)
        runtimeMode = try container.decodeIfPresent(String.self, forKey: .runtimeMode)
        maxTokens = try container.decodeIfPresent(Int.self, forKey: .maxTokens)
    }
}

struct ModelOption: Codable, Identifiable, Equatable {
    let id: String
    let label: String
    let type: String
    let supportsVision: Bool
}

struct SecurityReport: Codable {
    struct MemoryReport: Codable {
        let count: Int
        let deleteGateEnabled: Bool
        let signedEntries: Int
    }

    struct UsageReport: Codable {
        let requests: Int
        let rateLimitedResponses: Int
        let lastRequestAt: String?
        let alerts: [String]
    }

    struct SignatureReport: Codable {
        let algorithm: String
        let memoryDeleteSignature: String
    }

    let runtimeMode: String
    let localOnly: Bool
    let selectedModel: ModelOption
    let supportedModels: [ModelOption]
    let maxTokens: Int
    let memory: MemoryReport
    let usage: UsageReport
    let signature: SignatureReport
}

struct MemoryEntry: Codable, Identifiable, Equatable {
    let id: String
    let content: String
    let kind: String
    let author: String
    let createdAt: String
    let signature: String
}

enum RuntimeMode: String, Codable, CaseIterable {
    case offline
    case hybrid
    case online
}

class APIClient {
    private static var baseURL: String {
        Configuration.shared.apiBaseURL
    }

    static func sendMessage(
        prompt: String,
        maxTokens: Int? = nil,
        modelId: String? = nil,
        runtimeMode: RuntimeMode? = nil,
        completion: @escaping (Result<String, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/chat") else {
            completion(.failure(APIError.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 30.0

        let chatRequest = ChatRequest(
            message: prompt,
            context: [],
            maxTokens: maxTokens,
            modelId: modelId,
            runtimeMode: runtimeMode
        )

        do {
            request.httpBody = try JSONEncoder().encode(chatRequest)
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
                    if httpResponse.statusCode == 429 {
                        let retryAfterHeader = httpResponse.value(forHTTPHeaderField: "Retry-After")
                        let retryAfterSeconds = Int(retryAfterHeader ?? "") ?? nil
                        completion(.failure(APIError.rateLimited(retryAfter: retryAfterSeconds)))
                        return
                    }

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

        URLSession.shared.dataTask(with: URLRequest(url: url)) { _, response, error in
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

    static func fetchSecurityReport(completion: @escaping (Result<SecurityReport, Error>) -> Void) {
        performJSONRequest(path: "/security/report", completion: completion)
    }

    static func fetchModels(completion: @escaping (Result<[ModelOption], Error>) -> Void) {
        performJSONRequest(path: "/models") { (result: Result<ModelsResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.models))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func setRuntimeMode(_ mode: RuntimeMode, completion: @escaping (Result<RuntimeMode, Error>) -> Void) {
        performMutation(path: "/runtime/mode", body: ["runtimeMode": mode.rawValue]) { (result: Result<RuntimeModeResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.runtimeMode))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func setMaxTokens(_ maxTokens: Int, completion: @escaping (Result<Int, Error>) -> Void) {
        performMutation(path: "/runtime/max-tokens", body: ["maxTokens": maxTokens]) { (result: Result<MaxTokensResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.maxTokens))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func selectModel(_ modelId: String, completion: @escaping (Result<ModelOption, Error>) -> Void) {
        performMutation(path: "/models/active", body: ["modelId": modelId]) { (result: Result<ActiveModelResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.active))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func fetchMemory(completion: @escaping (Result<[MemoryEntry], Error>) -> Void) {
        performJSONRequest(path: "/memory") { (result: Result<MemoryResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.memory))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func addMemory(_ content: String, kind: String = "text", completion: @escaping (Result<MemoryEntry, Error>) -> Void) {
        performMutation(path: "/memory", body: ["content": content, "kind": kind]) { (result: Result<CreatedMemoryResponse, Error>) in
            switch result {
            case .success(let payload):
                completion(.success(payload.memory))
            case .failure(let error):
                completion(.failure(error))
            }
        }
    }

    static func deleteMemory(
        id: String,
        confirmDelete: Bool,
        signature: String,
        completion: @escaping (Result<Void, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)/memory/\(id)") else {
            completion(.failure(APIError.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.setValue(confirmDelete ? "true" : "false", forHTTPHeaderField: "X-DevAssist-Confirm-Delete")
        request.setValue(signature, forHTTPHeaderField: "X-DevAssist-Delete-Signature")

        URLSession.shared.dataTask(with: request) { _, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(APIError.invalidResponse))
                    return
                }

                guard httpResponse.statusCode == 204 else {
                    completion(.failure(APIError.serverError(httpResponse.statusCode, "Failed to delete memory")))
                    return
                }

                completion(.success(()))
            }
        }.resume()
    }

    private static func performJSONRequest<Value: Decodable>(
        path: String,
        completion: @escaping (Result<Value, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            completion(.failure(APIError.invalidURL))
            return
        }

        URLSession.shared.dataTask(with: URLRequest(url: url)) { data, response, error in
            DispatchQueue.main.async {
                if let error = error {
                    completion(.failure(error))
                    return
                }

                guard let httpResponse = response as? HTTPURLResponse else {
                    completion(.failure(APIError.invalidResponse))
                    return
                }

                guard (200..<300).contains(httpResponse.statusCode) else {
                    completion(.failure(APIError.serverError(httpResponse.statusCode, "Unexpected response")))
                    return
                }

                guard let data = data else {
                    completion(.failure(APIError.noData))
                    return
                }

                do {
                    completion(.success(try JSONDecoder().decode(Value.self, from: data)))
                } catch {
                    completion(.failure(error))
                }
            }
        }.resume()
    }

    private static func performMutation<Value: Decodable>(
        path: String,
        body: [String: Any],
        completion: @escaping (Result<Value, Error>) -> Void
    ) {
        guard let url = URL(string: "\(baseURL)\(path)") else {
            completion(.failure(APIError.invalidURL))
            return
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        do {
            request.httpBody = try JSONSerialization.data(withJSONObject: body)
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

                guard (200..<300).contains(httpResponse.statusCode) else {
                    let errorMessage = String(data: data ?? Data(), encoding: .utf8) ?? "Unexpected response"
                    completion(.failure(APIError.serverError(httpResponse.statusCode, errorMessage)))
                    return
                }

                guard let data = data else {
                    completion(.failure(APIError.noData))
                    return
                }

                do {
                    completion(.success(try JSONDecoder().decode(Value.self, from: data)))
                } catch {
                    completion(.failure(error))
                }
            }
        }.resume()
    }
}

private struct ModelsResponse: Decodable {
    let active: ModelOption
    let models: [ModelOption]
}

private struct ActiveModelResponse: Decodable {
    let active: ModelOption
}

private struct RuntimeModeResponse: Decodable {
    let runtimeMode: RuntimeMode
}

private struct MaxTokensResponse: Decodable {
    let maxTokens: Int
}

private struct MemoryResponse: Decodable {
    let memory: [MemoryEntry]
}

private struct CreatedMemoryResponse: Decodable {
    let memory: MemoryEntry
}

enum APIError: LocalizedError {
    case invalidURL
    case encodingError
    case invalidResponse
    case noData
    case unauthorized
    case rateLimited(retryAfter: Int?)
    case serverUnavailable
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid server URL"
        case .encodingError:
            return "Request encoding failed"
        case .invalidResponse:
            return "Invalid server response"
        case .noData:
            return "No data received from server"
        case .unauthorized:
            return "Authentication required"
        case .rateLimited(let retryAfter):
            if let retryAfter {
                return "Rate limit exceeded. Try again in \(retryAfter) seconds."
            }
            return "Rate limit exceeded"
        case .serverUnavailable:
            return "Server is currently unavailable"
        case .serverError(let code, let message):
            return "Server error (\(code)): \(message)"
        }
    }
}
