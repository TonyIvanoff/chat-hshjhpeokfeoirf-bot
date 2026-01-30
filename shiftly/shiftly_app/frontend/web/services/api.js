import axios from 'axios';

const API_URL = "http://127.0.0.1:8000";

export const api = axios.create({
    baseURL: API_URL,
    headers: {
        "Content-Type": "application/json",
    },
});

// Request Interceptor to add Token
api.interceptors.request.use(
    (config) => {
        // Next.js Server Side safety check
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem("token");
            if (token) {
                config.headers["Authorization"] = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => console.error(error)
);

// Response Interceptor for global error handling (e.g. 401)
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (typeof window !== 'undefined' && error.response && error.response.status === 401) {
            console.warn("Unauthorized, redirecting to login...");
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

export const login = async (username, password) => {
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    const response = await api.post("/auth/token", params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    return response.data;
};

export const register = async (userData) => {
    const response = await api.post("/auth/register", userData);
    return response.data;
};

export const getRequests = async () => {
    const response = await api.get("/requests/");
    return response.data;
}

export const getRequest = async (id) => {
    const response = await api.get(`/requests/${id}`);
    return response.data;
}

export const createRequest = async (requestData) => {
    const response = await api.post("/requests/", requestData);
    return response.data;
}

export const uploadImage = async (requestId, file, triggerAnalysis = true) => {
    const formData = new FormData();
    formData.append("file", file);

    const response = await api.post(`/requests/${requestId}/images?trigger_analysis=${triggerAnalysis}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
    return response.data;
}

export const analyzeRequest = async (requestId) => {
    const response = await api.post(`/requests/${requestId}/analyze`);
    return response.data;
}

export const deleteRequest = async (id) => {
    const response = await api.delete(`/requests/${id}`);
    return response.data;
}

export const addItem = async (requestId, itemData) => {
    const response = await api.post(`/requests/${requestId}/items`, itemData);
    return response.data;
}

export const updateItem = async (itemId, itemData) => {
    const response = await api.put(`/requests/items/${itemId}`, itemData);
    return response.data;
}

export const deleteItem = async (itemId) => {
    const response = await api.delete(`/requests/items/${itemId}`);
    return response.data;
}

// User Profile APIs
export const getProfile = async () => {
    const response = await api.get("/auth/me");
    return response.data;
};

export const updateProfile = async (userData) => {
    const response = await api.put("/auth/me", userData);
    return response.data;
};

export const changePassword = async (passwordData) => {
    const response = await api.post("/auth/change-password", passwordData);
    return response.data;
};

// Admin APIs
export const getUsers = async () => {
    const response = await api.get("/admin/users");
    return response.data;
};

export const updateUser = async (userId, userData) => {
    const response = await api.put(`/admin/users/${userId}`, userData);
    return response.data;
};

export const createUser = async (userData) => {
    const response = await api.post("/admin/users", userData);
    return response.data;
};

export const deleteUser = async (userId) => {
    const response = await api.delete(`/admin/users/${userId}`);
    return response.data;
};

// Admin Request APIs
export const getAllRequests = async (search = '') => {
    const response = await api.get(`/admin/requests`, { params: { search } });
    return response.data;
};

export const deleteRequestAdmin = async (requestId) => {
    const response = await api.delete(`/admin/requests/${requestId}`);
    return response.data;
};

// Admin Module APIs
export const getModules = async () => {
    const response = await api.get('/admin/modules');
    return response.data;
};

export const getModuleVersions = async (type, name) => {
    const response = await api.get('/admin/modules/versions', { params: { type, name } });
    return response.data;
};

export const manageModule = async (type, name, action, version = null) => {
    const response = await api.post('/admin/modules/manage', { type, name, action, version });
    return response.data;
};

export const startModuleJob = async (type, name, action, version = null) => {
    const response = await api.post('/admin/modules/jobs/start', { type, name, action, version });
    return response.data;
};

export const getJobStatus = async (jobId) => {
    const response = await api.get(`/admin/modules/jobs/${jobId}`);
    return response.data;
};

export const getModuleHistory = async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const response = await api.get('/admin/modules/history', { params: { skip, limit } });
    return response.data;
};

// Admin AI Training APIs
export const getTrainingStats = async () => {
    const response = await api.get('/admin/training/stats');
    return response.data;
};

export const startTraining = async () => {
    const response = await api.post('/admin/training/train');
    return response.data;
};

export const getTrainingHistory = async (page = 1, limit = 10) => {
    const skip = (page - 1) * limit;
    const response = await api.get('/admin/training/history', { params: { skip, limit } });
    return response.data;
};

export default api;
