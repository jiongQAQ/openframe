import { createFileRoute } from "@tanstack/react-router"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export const Route = createFileRoute("/login")({
  component: LoginPage,
})

function LoginPage() {
  const { t } = useTranslation()
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const result = isRegister
        ? await window.authAPI.register(username, password)
        : await window.authAPI.login(username, password)
      if (result.ok) {
        window.location.hash = "#/projects"
        window.location.reload()
      } else {
        setError(result.error)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-96">
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800">
          {isRegister ? t("auth.register") : t("auth.login")}
        </h1>
        <p className="text-center text-gray-500 mb-6 text-sm">
          {isRegister ? t("auth.registerDesc") : t("auth.loginDesc")}
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.username")}
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t("auth.password")}
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              required
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition"
          >
            {loading ? t("common.loading") : (isRegister ? t("auth.registerBtn") : t("auth.loginBtn"))}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-gray-500">
          {isRegister ? t("auth.hasAccount") : t("auth.noAccount")}
          <button
            onClick={() => { setIsRegister(!isRegister); setError("") }}
            className="text-indigo-600 hover:underline font-medium ml-1"
          >
            {isRegister ? t("auth.loginNow") : t("auth.registerNow")}
          </button>
        </div>
      </div>
    </div>
  )
}
