import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/ui/Toast'
import './styles/index.css'

// 能力探测：只有 Chromium 系支持 backdrop-filter: url(#filter)，
// 其余浏览器（Firefox/Safari）保持普通毛玻璃回退，避免浮层失去背景模糊
try {
  if (window.CSS?.supports?.('backdrop-filter', 'url(#liquid-glass) blur(2px)')) {
    document.documentElement.classList.add('has-refract')
  }
} catch { /* 探测异常按不支持处理 */ }

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
