import SwiftUI

struct DataAnalysisView: View {
    @State private var inputData: String = ""
    @State private var analysisResult: DataAnalysis?
    @State private var isLoading: Bool = false
    @State private var errorMessage: String?
    
    var body: some View {
        VStack(spacing: 20) {
            Text("Data Analysis")
                .font(.largeTitle)
                .fontWeight(.bold)
            
            VStack(alignment: .leading, spacing: 10) {
                Text("Enter numerical data:")
                    .font(.headline)
                
                TextEditor(text: $inputData)
                    .frame(height: 100)
                    .padding(8)
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color.gray.opacity(0.3), lineWidth: 1)
                    )
            }
            
            Button(action: analyzeData) {
                HStack {
                    if isLoading {
                        ProgressView()
                            .scaleEffect(0.8)
                    }
                    Text(isLoading ? "Analyzing..." : "Analyze Data")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(10)
            }
            .disabled(inputData.isEmpty || isLoading)
            
            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .padding()
                    .background(Color.red.opacity(0.1))
                    .cornerRadius(8)
            }
            
            if let result = analysisResult {
                AnalysisResultView(analysis: result)
            }
            
            Spacer()
        }
        .padding()
    }
    
    private func analyzeData() {
        guard !inputData.isEmpty else { return }
        
        isLoading = true
        errorMessage = nil
        
        DataAPIClient.processData(data: inputData) { result in
            DispatchQueue.main.async {
                isLoading = false
                
                switch result {
                case .success(let analysis):
                    self.analysisResult = analysis
                case .failure(let error):
                    self.errorMessage = error.localizedDescription
                }
            }
        }
    }
}

struct AnalysisResultView: View {
    let analysis: DataAnalysis
    
    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Analysis Results")
                .font(.headline)
                .fontWeight(.semibold)
            
            VStack(alignment: .leading, spacing: 8) {
                AnalysisRow(label: "Count", value: "\(analysis.count)")
                AnalysisRow(label: "Sum", value: "\(analysis.sum)")
                AnalysisRow(label: "Average", value: String(format: "%.2f", analysis.average))
                AnalysisRow(label: "Min", value: "\(analysis.min)")
                AnalysisRow(label: "Max", value: "\(analysis.max)")
                AnalysisRow(label: "Unique Values", value: "\(analysis.unique)")
            }
            
            if let response = analysis.response {
                Text("AI Response:")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .padding(.top)
                
                Text(response)
                    .padding()
                    .background(Color.blue.opacity(0.1))
                    .cornerRadius(8)
            }
        }
        .padding()
        .background(Color.gray.opacity(0.05))
        .cornerRadius(12)
    }
}

struct AnalysisRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label + ":")
                .fontWeight(.medium)
            Spacer()
            Text(value)
                .foregroundColor(.secondary)
        }
    }
}

struct DataAnalysis: Codable {
    let count: Int
    let sum: Int
    let average: Double
    let min: Int
    let max: Int
    let unique: Int
    let response: String?
}

class DataAPIClient {
    static func processData(data: String, completion: @escaping (Result<DataAnalysis, Error>) -> Void) {
        guard let url = URL(string: "\(APIClient.baseURL)/process-data") else {
            completion(.failure(APIError.invalidURL))
            return
        }
        
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let requestBody = ["data": data]
        
        do {
            let jsonData = try JSONSerialization.data(withJSONObject: requestBody)
            request.httpBody = jsonData
        } catch {
            completion(.failure(error))
            return
        }
        
        URLSession.shared.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(APIError.noData))
                return
            }
            
            do {
                let result = try JSONDecoder().decode(DataProcessingResponse.self, from: data)
                completion(.success(result.analysis))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
}

struct DataProcessingResponse: Codable {
    let analysis: DataAnalysis
    let response: String
    let timestamp: String
}
