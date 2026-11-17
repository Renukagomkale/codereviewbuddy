import { useEffect, useState } from "react";

const BASE = import.meta.env.VITE_API_URL || "http://localhost:4000/api";
const KEY = "crb_token";

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (token) => localStorage.setItem(KEY, token);
export const clearToken = () => localStorage.removeItem(KEY);

export async function api(path, { method = "GET", body } = {}) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...(body && { "Content-Type": "application/json" }), ...(token && { Authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
  } catch {
    throw new Error("Cannot reach the server. Is the backend running?");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    clearToken();
    window.location.assign("/login");
  }
  if (!response.ok) throw new Error(data.error?.message || "Something went wrong");
  return data;
}

export function useApi(path) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState((current) => ({ ...current, loading: true, error: null }));
    api(path)
      .then((data) => active && setState({ data, error: null, loading: false }))
      .catch((error) => active && setState({ data: null, error: error.message, loading: false }));
    return () => {
      active = false;
    };
  }, [path, attempt]);

  return { ...state, reload: () => setAttempt((count) => count + 1) };
}
