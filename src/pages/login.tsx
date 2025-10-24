import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, User, Lock, Mail, UserPlus, LogIn, Circle, Dot } from 'lucide-react';

interface FormData {
  loginUsername: string;
  loginPassword: string;
  regUsername: string;
  regEmail: string;
  regPassword: string;
  regPassword2: string;
  remember: boolean;
}

interface ShowPassword {
  loginPassword: boolean;
  regPassword: boolean;
  regPassword2: boolean;
}

interface Errors {
  [key: string]: string;
}

// --- Security Utility Functions ---
const getCSRFToken = () => {
  const m = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};

const evalStrength = (pw: string) => {
  if (!pw) return { score: 0, label: 'Empty' };
  let s = 0;
  if (pw.length >= 8) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  if (pw.length >= 16) s++;
  const labels = ['Very Weak', 'Weak', 'Fair', 'Good', 'Strong', 'Robust', 'Robust'];
  return { score: s, label: labels[Math.min(s, labels.length - 1)] };
};

const meetsBackendPasswordRules = (pw: string) => {
  if (!pw || pw.length < 6) return false;
  const commonBad = ["password", "123456", "qwerty", "letmein", "admin", "welcome"];
  if (commonBad.includes(pw.toLowerCase())) return false;
  let classes = 0;
  if (/[a-z]/.test(pw)) classes++;
  if (/[A-Z]/.test(pw)) classes++;
  if (/\d/.test(pw)) classes++;
  if (/[^A-Za-z0-9]/.test(pw)) classes++;
  return classes >= 3;
};

const ModernLoginPage = () => {
  const [currentView, setCurrentView] = useState<'login' | 'register'>('login');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [showPassword, setShowPassword] = useState<ShowPassword>({
    loginPassword: false,
    regPassword: false,
    regPassword2: false
  });
  const [formData, setFormData] = useState<FormData>({
    loginUsername: '',
    loginPassword: '',
    regUsername: '',
    regEmail: '',
    regPassword: '',
    regPassword2: '',
    remember: false
  });
  const [errors, setErrors] = useState<Errors>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const updateDate = () => {
      const now = new Date();
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      } as const;
      setCurrentDate(now.toLocaleDateString('en-US', options).toUpperCase());
    };

    updateDate();
    const savedTheme = localStorage.getItem('monoTheme') || 'light';
    setTheme(savedTheme as 'light' | 'dark');
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    localStorage.setItem('monoTheme', newTheme);
  };

  const togglePasswordVisibility = (field: keyof ShowPassword) => {
    setShowPassword(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  // --- Password confirmation live validation ---
  useEffect(() => {
    if (
      formData.regPassword2 &&
      formData.regPassword !== formData.regPassword2
    ) {
      setErrors(prev => ({ ...prev, regPassword2: 'Passwords do not match' }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors['regPassword2'];
        return newErrors;
      });
    }
  }, [formData.regPassword, formData.regPassword2]);

  // --- Keyboard shortcut to toggle view ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        switchView(currentView === 'login' ? 'register' : 'login');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentView]);

  // --- Password strength ---
  const { score, label } = evalStrength(formData.regPassword);

  // --- Form validation ---
  const validateForm = (view: 'login' | 'register'): boolean => {
    const newErrors: Errors = {};

    if (view === 'login') {
      if (!formData.loginUsername.trim()) {
        newErrors['loginUsername'] = 'Username is required';
      }
      if (!formData.loginPassword) {
        newErrors['loginPassword'] = 'Password is required';
      }
    } else {
      if (!/^[A-Za-z0-9_.-]{3,32}$/.test(formData.regUsername)) {
        newErrors['regUsername'] = 'Username must be 3–32 chars: letters, numbers, _.- only.';
      }
      if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(formData.regEmail)) {
        newErrors['regEmail'] = 'Please enter a valid email address!';
      }
      if (!meetsBackendPasswordRules(formData.regPassword)) {
        newErrors['regPassword'] = 'Password must be 8+ chars and include 3 of: upper, lower, number, symbol.';
      }
      if (formData.regPassword !== formData.regPassword2) {
        newErrors['regPassword2'] = 'Passwords do not match';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // --- Secure form submission ---
    const handleSubmit = async (e: React.FormEvent, view: 'login' | 'register') => {
        e.preventDefault();
        if (!validateForm(view)) return;
        setIsLoading(true);

        try {
            const url = view === 'login' ? '/login' : '/register';
            const payload = view === 'login'
                ? {
                    username: formData.loginUsername,
                    password: formData.loginPassword,
                    remember: formData.remember
                }
                : {
                    username: formData.regUsername,
                    email: formData.regEmail,
                    password: formData.regPassword,
                    confirm_password: formData.regPassword2
                };

            const csrfToken = getCSRFToken();

            const res = await fetch(url, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRF-Token': csrfToken
                },
                body: JSON.stringify(payload)
            });

            if (res.headers.get('content-type')?.includes('application/json')) {
                const data = await res.json();
                
                // Handle successful response for both login and registration
                if (data.success) {
                    // Check for redirect field (both endpoints return 'redirect')
                    if (data.redirect) {
                        window.location.href = data.redirect; // Redirect to dashboard or appropriate page
                        return;
                    }
                }
                
                // Handle errors for both login and registration
                if (data.error) {
                    setErrors({ general: data.error });
                } else if (data.errors) {
                    // Handle field-specific errors (common in registration validation)
                    if (typeof data.errors === 'object' && !Array.isArray(data.errors)) {
                        setErrors(data.errors);
                    } else if (Array.isArray(data.errors)) {
                        const summary: Errors = {};
                        data.errors.forEach((msg: string, i: number) => { 
                            summary[`error${i}`] = msg; 
                        });
                        setErrors(summary);
                    } else if (typeof data.errors === 'string') {
                        setErrors({ general: data.errors });
                    }
                }
            } else if (res.redirected) {
                // Fallback for server-side redirects
                window.location.href = res.url;
            }
        } catch (err) {
            setErrors({ general: 'Network error. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };


  const switchView = (view: 'login' | 'register') => {
    if (view !== currentView) {
      setCurrentView(view);
      setErrors({});
    }
  };

  return (
    <>
      <style>{`
        @import url('/anurati.css');
        .anurati { font-family: 'Anurati', sans-serif; }
        .writing-mode-vertical { writing-mode: vertical-rl; text-orientation: mixed; }
        .fade-in-up { animation: fadeInUp 0.8s ease-out; }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        .view-transition { transition: all 0.6s cubic-bezier(0.4, 0, 0.2, 1); }
        .view-hidden { opacity: 0; transform: translateX(-20px); pointer-events: none; position: absolute; top: 0; left: 0; right: 0; }
        .input-focus { transition: all 0.3s ease; }
        .input-focus:focus { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); }
        body { overflow: hidden; }
        .main-container { height: 100vh; overflow: hidden; }
      `}</style>

      <div className={`main-container transition-colors duration-500 ${
        theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'
      } relative`}>
        {/* Fixed Elements */}
        <div className="fixed top-4 right-4 text-xs font-light text-gray-500 tracking-wide uppercase z-50">
          {currentDate}
        </div>
        <div className="anurati fixed right-4 top-1/2 transform -translate-y-1/2 writing-mode-vertical text-xs font-normal text-gray-400 tracking-widest uppercase z-50">
          ACCESS
        </div>
        <div className="fixed bottom-4 right-4 text-xs font-light text-gray-300 z-50">
          / / /
        </div>
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="fixed top-4 left-4 z-50 p-2 rounded-full transition-all duration-300 hover:bg-gray-100 dark:hover:bg-gray-800"
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <Circle className="w-5 h-5" />
          ) : (
            <Dot className="w-5 h-5" />
          )}
        </button>
        {/* Geometric Elements */}
        <div className="absolute w-24 h-16 top-[10%] right-[8%] border border-gray-200 dark:border-gray-700 transform rotate-45 pointer-events-none z-10"></div>
        <div className="absolute w-16 h-16 bottom-[20%] left-[15%] border border-gray-200 dark:border-gray-700 rounded-full pointer-events-none z-10"></div>
        {/* Main Content */}
        <div className="flex h-full items-center justify-center px-4">
          <div className="w-full max-w-sm">
            {/* Brand Header */}
            <div className="text-center mb-8 fade-in-up">
              <div className="anurati text-xs font-normal text-gray-400 tracking-widest uppercase mb-3">
                {currentView === 'login' ? 'Welcome Back' : 'Join Us'}
              </div>
              <h1 className="text-4xl font-extralight leading-none mb-3 tracking-tight">
                {currentView === 'login' ? (
                  <>
                    Sign
                    <span className="font-semibold block mt-1">In</span>
                  </>
                ) : (
                  <>
                    Create
                    <span className="font-semibold block mt-1">Account</span>
                  </>
                )}
              </h1>
              <p className="text-sm font-light text-gray-600 dark:text-gray-400 leading-tight max-w-xs mx-auto">
                {currentView === 'login'
                  ? 'Access your space securely.'
                  : 'Just a few details to get started.'}
              </p>
            </div>

            {/* Forms Container */}
            <div className="relative min-h-0">
              {/* --- Error summary --- */}
              {Object.keys(errors).length > 0 && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-xs rounded mb-2">
                  <strong>Please fix the following:</strong>
                  <ul className="ml-3 list-disc">
                    {Object.values(errors).map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {/* Login Form */}
              <div className={`view-transition ${currentView !== 'login' ? 'view-hidden' : ''}`}>
                <form onSubmit={(e) => handleSubmit(e, 'login')} className="space-y-4" autoComplete="off">
                  <div>
                    <label htmlFor="loginUsername" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        id="loginUsername"
                        value={formData.loginUsername}
                        onChange={(e) => handleInputChange('loginUsername', e.target.value)}
                        className={`input-focus w-full pl-10 pr-4 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.loginUsername
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="Your username"
                        autoComplete="off"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.loginUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.loginUsername}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="loginPassword" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword.loginPassword ? 'text' : 'password'}
                        id="loginPassword"
                        value={formData.loginPassword}
                        onChange={(e) => handleInputChange('loginPassword', e.target.value)}
                        className={`input-focus w-full pl-10 pr-10 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.loginPassword
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="••••••••"
                        autoComplete="off"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('loginPassword')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword.loginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.loginPassword && (
                      <p className="text-red-500 text-xs mt-1">{errors.loginPassword}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={formData.remember}
                        onChange={(e) => handleInputChange('remember', e.target.checked)}
                        className="mr-2"
                        disabled={isLoading}
                      />
                      <span className="text-gray-600 dark:text-gray-400">Remember me</span>
                    </label>
                    <a href="#" className="text-gray-600 dark:text-gray-400 hover:text-black dark:hover:text-white transition-colors">
                      Forgot?
                    </a>
                  </div>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="anurati w-full bg-black dark:bg-white text-white dark:text-black py-3 px-6 text-xs font-normal tracking-wider uppercase transition-all duration-300 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <LogIn className="w-4 h-4" />
                        Sign In
                      </>
                    )}
                  </button>
                  <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Need an account? </span>
                    <button
                      type="button"
                      onClick={() => switchView('register')}
                      className="text-sm text-black dark:text-white hover:underline font-medium"
                      disabled={isLoading}
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>

              {/* Register Form */}
              <div className={`view-transition ${currentView !== 'register' ? 'view-hidden' : ''}`}>
                <form onSubmit={(e) => handleSubmit(e, 'register')} className="space-y-4" autoComplete="off">
                  <div>
                    <label htmlFor="regUsername" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Username
                    </label>
                    <div className="relative">
                      <UserPlus className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        id="regUsername"
                        value={formData.regUsername}
                        onChange={(e) => handleInputChange('regUsername', e.target.value)}
                        className={`input-focus w-full pl-10 pr-4 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.regUsername
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="Choose a username"
                        autoComplete="off"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.regUsername && (
                      <p className="text-red-500 text-xs mt-1">{errors.regUsername}</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="regEmail" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="email"
                        id="regEmail"
                        value={formData.regEmail}
                        onChange={(e) => handleInputChange('regEmail', e.target.value)}
                        className={`input-focus w-full pl-10 pr-4 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.regEmail
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="you@email.com"
                        autoComplete="off"
                        disabled={isLoading}
                      />
                    </div>
                    {errors.regEmail && (
                      <p className="text-red-500 text-xs mt-1">{errors.regEmail}</p>
                    )}
                  </div>
                  {/* Password Field */}
                  <div>
                    <label htmlFor="regPassword" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword.regPassword ? 'text' : 'password'}
                        id="regPassword"
                        value={formData.regPassword}
                        onChange={(e) => handleInputChange('regPassword', e.target.value)}
                        className={`input-focus w-full pl-10 pr-10 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.regPassword
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="••••••••"
                        autoComplete="off"
                        disabled={isLoading}
                        onPaste={e => e.preventDefault()} // Disable paste for password
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('regPassword')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword.regPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Password strength display */}
                    <div className="mt-1 flex items-center gap-2">
                      <span
                        className={`text-xs ${
                          score <= 1
                            ? 'text-red-500'
                            : score <= 3
                            ? 'text-yellow-500'
                            : 'text-green-500'
                        }`}
                      >
                        {label}
                      </span>
                      <div className="flex-1 h-1 ml-2 rounded bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div
                          className={`h-full rounded transition-all duration-300 ${
                            score === 0
                              ? 'w-0'
                              : score === 1
                              ? 'w-1/5 bg-red-400'
                              : score === 2
                              ? 'w-2/5 bg-yellow-400'
                              : score === 3
                              ? 'w-3/5 bg-yellow-500'
                              : score === 4
                              ? 'w-4/5 bg-green-400'
                              : 'w-full bg-green-600'
                          }`}
                        />
                      </div>
                    </div>
                    {errors.regPassword && (
                      <p className="text-red-500 text-xs mt-1">{errors.regPassword}</p>
                    )}
                  </div>
                  {/* Confirm Password Field */}
                  <div>
                    <label htmlFor="regPassword2" className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type={showPassword.regPassword2 ? 'text' : 'password'}
                        id="regPassword2"
                        value={formData.regPassword2}
                        onChange={(e) => handleInputChange('regPassword2', e.target.value)}
                        className={`input-focus w-full pl-10 pr-10 py-3 border rounded-none bg-transparent text-sm transition-all duration-300 ${
                          errors.regPassword2
                            ? 'border-red-500 focus:border-red-500'
                            : 'border-gray-200 dark:border-gray-700 focus:border-black dark:focus:border-white'
                        } focus:outline-none`}
                        placeholder="Repeat password"
                        autoComplete="off"
                        disabled={isLoading}
                        onPaste={e => e.preventDefault()} // Disable paste for password
                      />
                      <button
                        type="button"
                        onClick={() => togglePasswordVisibility('regPassword2')}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {showPassword.regPassword2 ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.regPassword2 && (
                      <p className="text-red-500 text-xs mt-1">{errors.regPassword2}</p>
                    )}
                  </div>
                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="anurati w-full bg-black dark:bg-white text-white dark:text-black py-3 px-6 text-xs font-normal tracking-wider uppercase transition-all duration-300 hover:bg-gray-800 dark:hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Create Account
                      </>
                    )}
                  </button>
                  {/* Switch to Login */}
                  <div className="text-center pt-4 border-t border-gray-100 dark:border-gray-800">
                    <span className="text-sm text-gray-600 dark:text-gray-400">Already have an account? </span>
                    <button
                      type="button"
                      onClick={() => switchView('login')}
                      className="text-sm text-black dark:text-white hover:underline font-medium"
                      disabled={isLoading}
                    >
                      Sign In
                    </button>
                  </div>
                </form>
              </div>
            </div>
            {/* Footer */}
            <div className="text-center mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
                <span>&copy; 2025</span>
                <a href="#" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Privacy</a>
                <a href="#" className="hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Terms</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ModernLoginPage;
