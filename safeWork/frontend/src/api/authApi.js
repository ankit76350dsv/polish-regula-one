const API_BASE_URL = "http://localhost:8080/api";

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Returns the user object directly so AuthContext / Redux store get a clean shape.
// Backend wraps all responses in { success, data, message } — unwrap here.
export const getMe = async () => {
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error("User is not authenticated");
  }

  const json = await response.json();
  // Extract just the user object so state.auth.user.tenantId works directly
  return json?.data?.user ?? json?.data ?? json;
};

export const loginUser = async ({ email, password }) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson?.message || "Invalid email or password");
  }

  const json = await response.json();

  // Token lives in json.data.token in our backend envelope
  const token = json?.data?.token ?? json?.token ?? json?.accessToken;
  if (token) localStorage.setItem("accessToken", token);

  return json;
};

export const logoutUser = () => {
  localStorage.removeItem("accessToken");
};
