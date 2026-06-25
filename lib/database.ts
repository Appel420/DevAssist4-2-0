export interface ChatSession {
  id: string
  user_id: string
  title: string
  created_at: string
  updated_at: string
}

export interface ChatMessage {
  id: string
  session_id: string
  content: string
  is_user: boolean
  created_at: string
}

const sessions = new Map<string, ChatSession>()
const messages = new Map<string, ChatMessage[]>()

export class DatabaseService {
  async createChatSession(userId: string, title: string): Promise<ChatSession> {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      user_id: userId,
      title,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    sessions.set(session.id, session)
    messages.set(session.id, [])
    return session
  }

  async saveChatMessage(sessionId: string, content: string, isUser: boolean): Promise<ChatMessage> {
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      session_id: sessionId,
      content,
      is_user: isUser,
      created_at: new Date().toISOString(),
    }

    const existing = messages.get(sessionId) || []
    existing.push(message)
    messages.set(sessionId, existing)

    const session = sessions.get(sessionId)
    if (session) {
      sessions.set(sessionId, { ...session, updated_at: new Date().toISOString() })
    }

    return message
  }

  async getChatHistory(sessionId: string): Promise<ChatMessage[]> {
    return messages.get(sessionId) || []
  }
}

export const dbService = new DatabaseService()
