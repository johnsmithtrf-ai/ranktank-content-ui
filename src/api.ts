const API_BASE = 'https://content-api.startmyonlinecourses.com';

export async function login(username: string, password: string) {
  const r = await fetch(`${API_BASE}/login`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({username, password})
  });
  if (!r.ok) throw new Error('Login failed');
  const data = await r.json();
  localStorage.setItem('token', data.access_token || data.token);
  return data;
}

export function getToken() {
  return localStorage.getItem('token') || '';
}

export function logout() {
  localStorage.removeItem('token');
}

export async function getQueues() {
  const r = await fetch(`${API_BASE}/queues`, {
    headers: {Authorization: `Bearer ${getToken()}`}
  });
  if (r.status === 401) { logout(); throw new Error('Unauthorized'); }
  return r.json();
}

export async function addTask(data: unknown) {
  const r = await fetch(`${API_BASE}/tasks/add`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}`},
    body: JSON.stringify(data)
  });
  if (r.status === 401) { logout(); throw new Error('Unauthorized'); }
  return r.json();
}

export async function stopTask(botId: string, taskId: string) {
  const r = await fetch(`${API_BASE}/tasks/${botId}/${taskId}/stop`, {
    method: 'POST',
    headers: {Authorization: `Bearer ${getToken()}`}
  });
  return r.json();
}

export async function deleteTask(taskId: number) {
  const r = await fetch(`${API_BASE}/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {Authorization: `Bearer ${getToken()}`}
  });
  return r.json();
}

export async function getHistory() {
  const r = await fetch(`${API_BASE}/tasks/history`, {
    headers: {Authorization: `Bearer ${getToken()}`}
  });
  if (r.status === 401) { logout(); throw new Error('Unauthorized'); }
  return r.json();
}
