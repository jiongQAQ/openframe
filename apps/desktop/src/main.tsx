import './i18n'

// 恢复上次保存的主题
const savedTheme = localStorage.getItem('theme')
if (savedTheme && savedTheme !== 'system') {
  document.documentElement.setAttribute('data-theme', savedTheme)
}
import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import { createHashHistory, createRouter, RouterProvider } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

const hashHistory = createHashHistory()
const router = createRouter({ routeTree, history: hashHistory })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)

// Use contextBridge
window.ipcRenderer.on('main-process-message', (_event, message) => {
  console.log(message)
})
