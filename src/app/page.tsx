export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-5xl font-bold text-white mb-4">
            🚀 OneSaaS
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            SaaS 프로젝트가 성공적으로 생성되었습니다!
          </p>

          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-2xl mx-auto">
            <h2 className="text-2xl font-semibold text-white mb-6">
              다음 단계
            </h2>

            <div className="space-y-4 text-left">
              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">1</span>
                <div>
                  <h3 className="text-white font-medium">Claude Code로 개발 시작</h3>
                  <code className="text-sm text-gray-400">claude</code>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">2</span>
                <div>
                  <h3 className="text-white font-medium">데이터베이스 설정</h3>
                  <code className="text-sm text-gray-400">pnpm db:push</code>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center text-white font-bold">3</span>
                <div>
                  <h3 className="text-white font-medium">개발 서버 실행</h3>
                  <code className="text-sm text-gray-400">pnpm dev</code>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <div className="bg-white/5 rounded-xl p-6">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-white font-medium mb-2">Next.js 14</h3>
              <p className="text-gray-400 text-sm">App Router & Server Components</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6">
              <div className="text-3xl mb-3">🗄️</div>
              <h3 className="text-white font-medium mb-2">Supabase</h3>
              <p className="text-gray-400 text-sm">PostgreSQL + Auth + Storage</p>
            </div>

            <div className="bg-white/5 rounded-xl p-6">
              <div className="text-3xl mb-3">🤖</div>
              <h3 className="text-white font-medium mb-2">AI Gateway</h3>
              <p className="text-gray-400 text-sm">OpenAI, Anthropic, Google</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
