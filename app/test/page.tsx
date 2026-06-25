import { ApiTest } from "@/components/api-test"

export default function TestPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">DevAssist 4.2.0 Testing</h1>
          <p className="text-blue-300">Test your API configuration and functionality</p>
        </div>

        <ApiTest />

        <div className="mt-8 text-center">
          <a
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            ← Back to DevAssist
          </a>
        </div>
      </div>
    </div>
  )
}
