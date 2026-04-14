import { getAuthHeaders } from "./auth.js";

const API_URL = "http://localhost:3001/api";

// ── NOTAS ──
export async function apiGetNotes(date, shift) {
  const params = new URLSearchParams();
  if (date) params.append("date", date);
  if (shift) params.append("shift", shift);
  const res = await fetch(`${API_URL}/notes?${params}`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener notas");
  return res.json();
}

export async function apiGetAllNotes() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/notes/all`, {
    headers: {
      ...headers,
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
    },
    cache: 'no-store',
  });
  if (res.status === 304 || res.status === 204) return [];
  if (!res.ok) throw new Error("Error al obtener notas");
  return res.json();
}

export async function apiCreateNote(note) {
  const res = await fetch(`${API_URL}/notes`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error("Error al crear nota");
  return res.json();
}

export async function apiUpdateNote(id, note) {
  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(note),
  });
  if (!res.ok) throw new Error("Error al actualizar nota");
  return res.json();
}

export async function apiDeleteNote(id) {
  const res = await fetch(`${API_URL}/notes/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar nota");
  return res.json();
}

// ── PROYECTOS ──
export async function apiGetProjects() {
  const res = await fetch(`${API_URL}/projects`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener proyectos");
  return res.json();
}

export async function apiCreateProject(project) {
  const res = await fetch(`${API_URL}/projects`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error("Error al crear proyecto");
  return res.json();
}

export async function apiUpdateProject(id, project) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(project),
  });
  if (!res.ok) throw new Error("Error al actualizar proyecto");
  return res.json();
}

export async function apiDeleteProject(id) {
  const res = await fetch(`${API_URL}/projects/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar proyecto");
  return res.json();
}

// ── POST-IT ──
export async function apiGetPostits() {
  const res = await fetch(`${API_URL}/postit`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener post-its");
  return res.json();
}

export async function apiCreatePostit(card) {
  const res = await fetch(`${API_URL}/postit`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error("Error al crear post-it");
  return res.json();
}

export async function apiUpdatePostit(id, card) {
  const res = await fetch(`${API_URL}/postit/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(card),
  });
  if (!res.ok) throw new Error("Error al actualizar post-it");
  return res.json();
}

export async function apiDeletePostit(id) {
  const res = await fetch(`${API_URL}/postit/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar post-it");
  return res.json();
}

// ── DOCUMENTOS ──
export async function apiGetDocs() {
  const res = await fetch(`${API_URL}/docs`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener documentos");
  return res.json();
}

export async function apiCreateDoc(doc) {
  const res = await fetch(`${API_URL}/docs`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error("Error al crear documento");
  return res.json();
}

export async function apiUpdateDoc(id, doc) {
  const res = await fetch(`${API_URL}/docs/${id}`, {
    method: "PUT",
    headers: await getAuthHeaders(),
    body: JSON.stringify(doc),
  });
  if (!res.ok) throw new Error("Error al actualizar documento");
  return res.json();
}

export async function apiDeleteDoc(id) {
  const res = await fetch(`${API_URL}/docs/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar documento");
  return res.json();
}

// ── TRASPASOS ──
export async function apiGetHandovers() {
  const res = await fetch(`${API_URL}/handovers`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener traspasos");
  return res.json();
}

export async function apiCreateHandover(handover) {
  const res = await fetch(`${API_URL}/handovers`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(handover),
  });
  if (!res.ok) throw new Error("Error al crear traspaso");
  return res.json();
}

export async function apiReceiveHandover(id) {
  const res = await fetch(`${API_URL}/handovers/${id}/receive`, {
    method: "PUT",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al confirmar traspaso");
  return res.json();
}

// ── COMENTARIOS ──
export async function apiGetComments(kind, targetId, extraId) {
  const params = new URLSearchParams();
  if (kind) params.append("kind", kind);
  if (targetId) params.append("targetId", targetId);
  if (extraId) params.append("extraId", extraId);
  const res = await fetch(`${API_URL}/comments?${params}`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener comentarios");
  return res.json();
}

export async function apiCreateComment(comment) {
  const res = await fetch(`${API_URL}/comments`, {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify(comment),
  });
  if (!res.ok) throw new Error("Error al crear comentario");
  return res.json();
}

export async function apiDeleteComment(id) {
  const res = await fetch(`${API_URL}/comments/${id}`, {
    method: "DELETE",
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al eliminar comentario");
  return res.json();
}

// ── USUARIO ACTUAL ──
export async function apiGetMe() {
  const res = await fetch(`${API_URL}/users/me`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener usuario");
  return res.json();
}

export async function apiGetDepartmentUsers() {
  const res = await fetch(`${API_URL}/users/department`, {
    headers: await getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Error al obtener usuarios del departamento");
  return res.json();
}
