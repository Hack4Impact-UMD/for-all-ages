import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './SignupLoginForm.module.css';

export default function SignupLoginForm() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ username: '', password: '', firstName: '', lastName: '', email: '', confirmPassword: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (tab === 'login') navigate('/dashboard');
    else console.log('Sign Up:', form);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const isLoginValid = form.username && form.password;
  const isSignupValid = form.firstName && form.lastName && form.email && form.password && form.confirmPassword && form.password === form.confirmPassword;

  return (
    <div className={styles.form}>
      <div className={styles.tabs}>
        <button className={tab === 'login' ? styles.active : ''} onClick={() => setTab('login')}>Log-In</button>
        <span className={styles.separator}>|</span>
        <button className={tab === 'signup' ? styles.active : ''} onClick={() => setTab('signup')}>Sign Up</button>
      </div>
      
          <form onSubmit={handleSubmit}>
            {tab === 'login' ? (
              <>
                <div className={styles.fieldGroup}>
                  <label>Username</label>
                  <input name="username" value={form.username} onChange={handleChange} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Password</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} />
                </div>
                <button disabled={!isLoginValid}>Log-In</button>
              </>
            ) : (
              <>
                <div className={styles.fieldGroup}>
                  <label>First Name</label>
                  <input name="firstName" value={form.firstName} onChange={handleChange} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Last Name</label>
                  <input name="lastName" value={form.lastName} onChange={handleChange} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Email</label>
                  <input name="email" value={form.email} onChange={handleChange} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Password</label>
                  <input name="password" type="password" value={form.password} onChange={handleChange} />
                </div>
                <div className={styles.fieldGroup}>
                  <label>Confirm Password</label>
                  <input name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} />
                  {form.password && form.confirmPassword && form.password !== form.confirmPassword && <div className={styles.error}>Passwords don't match</div>}
                </div>
                <button disabled={!isSignupValid}>Sign Up</button>
              </>
            )}
          </form>
    </div>
  );
}
