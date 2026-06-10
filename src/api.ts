const API = 'https://content-api.startmyonlinecourses.com'

function getToken() {
  return localStorage.getItem('token') || ''
}

function clearToken() {
  localStorage.removeItem('token')
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...((opts.headers as Record<string, string>) || {}),
    },
  })
  if (res.status === 401) {
    clearToken()
    throw new Error('Unauthorized')
  }
  return res.json()
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  return res.json()
}

export function saveToken(token: string) {
  localStorage.setItem('token', token)
}

export function isLoggedIn() {
  return !!getToken()
}

export function logout() {
  clearToken()
}

export async function getQueues() {
  return apiFetch('/queues')
}

export async function getHistory() {
  return apiFetch('/tasks/history')
}

export async function addTask(data: Record<string, unknown>) {
  return apiFetch('/tasks/add', { method: 'POST', body: JSON.stringify(data) })
}

export async function addBulkTasks(data: Record<string, unknown>) {
  return apiFetch('/tasks/bulk', { method: 'POST', body: JSON.stringify(data) })
}

export async function addBatchTasks(data: Record<string, unknown>) {
  return apiFetch('/tasks/batch', { method: 'POST', body: JSON.stringify(data) })
}

export async function getBatchLinks(batchGroupId: string, batchIndex?: number) {
  const q = batchIndex !== undefined ? `?batch_index=${batchIndex}` : ''
  return apiFetch(`/tasks/batch/${batchGroupId}/links${q}`)
}

export async function stopTask(botId: string, taskId: string) {
  return apiFetch(`/tasks/${botId}/${taskId}/stop`, { method: 'POST', body: JSON.stringify({}) })
}

export async function getDropboxFolders() {
  return apiFetch('/dropbox/folders')
}
