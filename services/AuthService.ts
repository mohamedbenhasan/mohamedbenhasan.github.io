import { User } from '../types';

const STORAGE_KEY = 'vru_guard_user';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    // Try to restore session
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.currentUser = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse user session');
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }

  getUser(): User | null {
    return this.currentUser;
  }

  // Simulated Login
  async login(email: string, password: string): Promise<User> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        // Mock validation
        if (password.length < 6) {
          reject(new Error("Invalid credentials"));
          return;
        }

        // Create mock user
        const role = email.toLowerCase().includes('admin') ? 'ADMIN' : 'OPERATOR';
        
        const user: User = {
          id: 'usr_' + Math.random().toString(36).substr(2, 9),
          name: email.split('@')[0], // Derive name from email for demo
          email: email,
          organization: 'Demo Corp Inc.',
          role: role
        };

        this.currentUser = user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        resolve(user);
      }, 1200); // Simulate network delay
    });
  }

  // Simulated Register
  async register(name: string, email: string, org: string, password: string, role: 'ADMIN' | 'OPERATOR' = 'OPERATOR'): Promise<User> {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        if (!email.includes('@')) {
          reject(new Error("Invalid email address"));
          return;
        }

        const user: User = {
          id: 'usr_' + Math.random().toString(36).substr(2, 9),
          name: name,
          email: email,
          organization: org,
          role: role
        };

        this.currentUser = user;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
        resolve(user);
      }, 1500);
    });
  }

  logout() {
    this.currentUser = null;
    localStorage.removeItem(STORAGE_KEY);
  }
}

export const authService = new AuthService();