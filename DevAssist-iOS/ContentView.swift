import SwiftUI

import AVKit



struct ContentView: View {

    @State private var messages: [ChatMessage] = [

        ChatMessage(text: "Hello! I am DevAssist. How can I assist you?", isUser: false)

    ]

    @State private var currentPrompt: String = ""

    let player = AVPlayer()



    var body: some View {

        NavigationView {

            VStack {

                VideoPlayer(player: player)

                    .frame(height: 220)

                    .onAppear {

                        try? AVAudioSession.sharedInstance()

                          .setCategory(.playback, mode: .moviePlayback)

                    }

                chatSection

            }

            .navigationTitle("DevAssist")

            .navigationBarTitleDisplayMode(.inline)

        }

    }



    private var chatSection: some View {

        VStack {

            ScrollView {

                VStack(alignment: .leading, spacing: 12) {

                    ForEach(messages) { msg in

                        MessageView(message: msg)

                    }

                }

                .padding()

            }

            HStack {

                TextField("Ask DevAssist...", text: $currentPrompt)

                    .textFieldStyle(RoundedBorderTextFieldStyle())

                    .padding(.leading)

                Button(action: sendMessage) {

                    Image(systemName: "arrow.up.circle.fill")

                        .font(.title)

                }

                .padding(.trailing)

                .disabled(currentPrompt.isEmpty)

            }

            .padding(.bottom, 8)

        }

    }



    private func sendMessage() {

        guard !currentPrompt.isEmpty else { return }

        let prompt = currentPrompt

        messages.append(.init(text: prompt, isUser: true))

        currentPrompt = ""

        APIClient.sendMessage(prompt: prompt) { result in

            DispatchQueue.main.async {

                switch result {

                case .success(let reply):

                    messages.append(.init(text: reply, isUser: false))

                case .failure:

                    messages.append(.init(text: "❌ Error contacting backend", isUser: false))

                }

            }

        }

    }

}



struct ChatMessage: Identifiable {

    let id = UUID(), text: String, isUser: Bool

}



struct MessageView: View {

    let message: ChatMessage

    var body: some View {

        HStack {

            if message.isUser {

                Spacer()

                Text(message.text)

                  .padding(12)

                  .background(Color.blue)

                  .foregroundColor(.white)

                  .cornerRadius(15)

            } else {

                Text(message.text)

                  .padding(12)

                  .background(Color(UIColor.systemGray5))

                  .cornerRadius(15)

                Spacer()

            }

        }

    }

}
