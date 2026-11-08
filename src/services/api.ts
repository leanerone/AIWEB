import axios from 'axios'

export const api = axios.create({ baseURL: '/api' })

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('aiweb_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (resp) => {
    const body = resp.data
    if (body && typeof body === 'object' && 'success' in body) {
      if (!body.success && body.message) {
        return Promise.reject(new Error(body.message))
      }
      resp.data = body.data
    }
    return resp
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('aiweb_token')
      localStorage.removeItem('aiweb_user')
      if (!location.pathname.startsWith('/login')) location.href = '/login'
    }
    const msg = err.response?.data?.detail || err.response?.data?.message || err.message
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)))
  },
)
