import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Her istekte JWT token ekle
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    // 401 → oturumu sonlandır, login'e yönlendir
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('kullanici')
      window.location.href = '/giris'
      return Promise.reject(new Error('Oturum süresi doldu'))
    }
    const message = error.response?.data?.error || 'Bir hata oluştu'
    return Promise.reject(new Error(message))
  }
)

export default api
