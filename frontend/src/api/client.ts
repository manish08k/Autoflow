import axios from 'axios'

export const BASE_URL = 'http://localhost:8000'

const http = axios.create({ baseURL: BASE_URL + '/api' })

http.interceptors.request.use(cfg => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = `Bearer ${token}`
  return cfg
})

http.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) {
    localStorage.removeItem('token')
    window.location.href = '/'
  }
  return Promise.reject(err)
})

export const authApi = {
  register: (email: string, password: string) =>
    http.post('/auth/register', { email, password }).then(r => r.data),
  login: (email: string, password: string) =>
    http.post('/auth/login', { email, password }).then(r => r.data),
  me: () => http.get('/auth/me').then(r => r.data),
}

export const workflowsApi = {
  list: () => http.get('/workflows').then(r => r.data),
  create: (data: any) => http.post('/workflows', data).then(r => r.data),
  get: (id: string) => http.get(`/workflows/${id}`).then(r => r.data),
  update: (id: string, data: any) => http.patch(`/workflows/${id}`, data).then(r => r.data),
  delete: (id: string) => http.delete(`/workflows/${id}`),
  activate: (id: string) => http.post(`/workflows/${id}/activate`).then(r => r.data),
  deactivate: (id: string) => http.post(`/workflows/${id}/deactivate`).then(r => r.data),
  execute: (id: string, triggerData?: any) =>
    http.post(`/workflows/${id}/execute`, triggerData || {}).then(r => r.data),
}

export const executionsApi = {
  list: (workflowId?: string) =>
    http.get('/executions', { params: workflowId ? { workflow_id: workflowId } : {} }).then(r => r.data),
  get: (id: string) => http.get(`/executions/${id}`).then(r => r.data),
  cancel: (id: string) => http.post(`/executions/${id}/cancel`).then(r => r.data),
}

export const credentialsApi = {
  list: (provider?: string) =>
    http.get('/credentials', { params: provider ? { provider } : {} }).then(r => r.data),
  rename: (id: string, label: string) =>
    http.patch(`/credentials/${id}`, { label }).then(r => r.data),
  test: (id: string) => http.post(`/credentials/${id}/test`).then(r => r.data),
  delete: (id: string) => http.delete(`/oauth/credentials/${id}`),
}

export const providersApi = {
  list: () => http.get('/providers').then(r => r.data),
}

export const triggersApi = {
  list: (workflowId?: string) =>
    http.get('/triggers', { params: workflowId ? { workflow_id: workflowId } : {} }).then(r => r.data),
  create: (data: any) => http.post('/triggers', data).then(r => r.data),
  delete: (id: string) => http.delete(`/triggers/${id}`),
}

export const schedulesApi = {
  list: (workflowId?: string) =>
    http.get('/schedules', { params: workflowId ? { workflow_id: workflowId } : {} }).then(r => r.data),
  create: (data: any) => http.post('/schedules', data).then(r => r.data),
  delete: (id: string) => http.delete(`/schedules/${id}`),
  toggle: (id: string) => http.patch(`/schedules/${id}/toggle`).then(r => r.data),
}

export const nodeTypesApi = {
  list: () => http.get('/node-types').then(r => r.data),
}
