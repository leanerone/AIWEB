import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { ToastProvider } from './components/ui/Toast'
import './styles/index.css'

// 玻璃能力门控不放在这里：CSS.supports('backdrop-filter','url()') 在 Firefox/Safari
// 会返回 true 却静默不渲染。改由 useLiquidGlass 逐元素 UA 门控并写入 data-lg-support
// （refraction / frost / solid 三级降级），见 src/hooks/useLiquidGlass.ts。

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </React.StrictMode>,
)
