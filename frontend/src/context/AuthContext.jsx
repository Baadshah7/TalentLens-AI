import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// Setup axios defaults
axios.defaults.baseURL = API_URL;

// Helper to check JWT expiration client-side
const isTokenExpired = (token) => {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return false;
    const currentTime = Date.now() / 1000;
    return payload.exp < currentTime;
  } catch (e) {
    return true; // invalid format is treated as expired
  }
};

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(() => {
    const storedUser = localStorage.getItem('user');
    const storedToken = localStorage.getItem('token');
    if (storedUser && storedToken && !isTokenExpired(storedToken)) {
      try {
        return JSON.parse(storedUser);
      } catch (e) {
        return null;
      }
    }
    return null;
  });
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    if (token) {
      if (isTokenExpired(token)) {
        setSessionExpired(true);
        logout();
      } else {
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            setUser(JSON.parse(storedUser));
          } catch (e) {
            console.error("Error parsing stored user details", e);
          }
        }
      }
    } else {
      delete axios.defaults.headers.common['Authorization'];
      setUser(null);
    }
    setLoading(false);
  }, [token]);

  // Request interceptor to catch 401s and logout
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          logout();
        }
        return Promise.reject(error);
      }
    );
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (email, password) => {
    try {
      const response = await axios.post('/auth/login', { Email: email, Password: password });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setSessionExpired(false);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Failed to authenticate. Please check your credentials.' 
      };
    }
  };

  const register = async (name, email, role, password) => {
    try {
      const response = await axios.post('/auth/register', { 
        Name: name, 
        Email: email, 
        Role: role, 
        Password: password 
      });
      const { access_token, user: userData } = response.data;
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setToken(access_token);
      setUser(userData);
      setSessionExpired(false);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Registration failed. Try a different email.' 
      };
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  };

  const candidateLoginRequest = async (email) => {
    try {
      const response = await axios.post('/assessments/candidate/login/request', { Email: email });
      return { success: true, message: response.data.message };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Candidate email address not found in screening directory.' 
      };
    }
  };

  const candidateLoginVerify = async (email, otpCode) => {
    try {
      const response = await axios.post('/assessments/candidate/login/verify', { Email: email, OTP_Code: otpCode });
      const { access_token, Candidate_ID, Email: cEmail, Name, Role } = response.data;
      
      const candidateUser = {
        User_ID: Candidate_ID,
        Candidate_ID: Candidate_ID,
        Email: cEmail,
        Name: Name,
        Role: Role
      };
      
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(candidateUser));
      
      setToken(access_token);
      setUser(candidateUser);
      setSessionExpired(false);
      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        message: error.response?.data?.detail || 'Verification code failed. Please check and retry.' 
      };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, token, loading, sessionExpired, setSessionExpired, 
      login, register, logout, candidateLoginRequest, candidateLoginVerify 
    }}>
      {loading ? (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-indigo-600 to-brand-600 flex items-center justify-center text-white font-bold text-2xl mb-4 animate-pulse shadow-lg glow-accent-violet">
            TL
          </div>
          <div className="flex items-center space-x-2">
            <svg className="animate-spin h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span className="text-sm font-medium text-slate-400">Verifying session...</span>
          </div>
        </div>
      ) : (
        children
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
