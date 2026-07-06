// 중요: IP 주소가 바뀌면 이 부분을 수정해야 합니다.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://dhsch.dahyeon.co.kr/api';

export const getProjects = async () => (await fetch(`${API_BASE_URL}/projects`)).json();
export const getDepartments = async () => (await fetch(`${API_BASE_URL}/departments`)).json();
export const getEmployees = async () => (await fetch(`${API_BASE_URL}/employees`)).json();

export const updateTaskPositions = async (projectId: string, tasks: any[]) => {
  const updates = tasks.map((t, index) => ({ id: t.id, position: index }));
  const response = await fetch(`${API_BASE_URL}/tasks/reorder`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks: updates })
  });
  if (!response.ok) throw new Error('Reorder failed');
  return response.json();
};

// CRUD Functions
export const addProject = async (name: string) => (await fetch(`${API_BASE_URL}/projects`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name}) })).json();
export const updateProject = async (id: string, name: string) => (await fetch(`${API_BASE_URL}/projects/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name}) })).json();
export const deleteProject = async (id: string) => fetch(`${API_BASE_URL}/projects/${id}`, { method: 'DELETE' });
export const updateProjects = async (projects: any[]) => fetch(`${API_BASE_URL}/projects/reorder`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ projects: projects.map((p, i) => ({id: p.id, position: i})) }) });
export const addTask = async (projectId: string, data: any) => (await fetch(`${API_BASE_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({...data, projectId}) })).json();
export const updateTask = async (pId: string, tId: string, data: any) => (await fetch(`${API_BASE_URL}/tasks/${tId}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data) })).json();
export const deleteTask = async (pId: string, tId: string) => fetch(`${API_BASE_URL}/tasks/${tId}`, { method: 'DELETE' });
export const addDepartment = async (name: string) => (await fetch(`${API_BASE_URL}/departments`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name}) })).json();
export const deleteDepartment = async (id: string) => fetch(`${API_BASE_URL}/departments/${id}`, { method: 'DELETE' });
export const addEmployee = async (name: string, dId: string) => (await fetch(`${API_BASE_URL}/employees`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({name, departmentId: dId}) })).json();
export const deleteEmployee = async (id: string) => fetch(`${API_BASE_URL}/employees/${id}`, { method: 'DELETE' });

// 관리자 비밀번호 (.env의 VITE_ADMIN_PASSWORD, 빌드 시점에 번들에 포함됨)
const ADMIN_PASSWORD: string = import.meta.env.VITE_ADMIN_PASSWORD || '';
export const hasAdminPassword = () => ADMIN_PASSWORD !== '';
export const verifyAdminPassword = (password: string) => password === ADMIN_PASSWORD;
