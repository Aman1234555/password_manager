
import React, { useEffect, useState } from 'react';
import { Button } from '../components/Button.jsx';
import { Field } from '../components/Field.jsx';
import { api, getCsrfToken } from '../lib/api.js';

export function AuthPage({ onLoggedIn }) {
  const [mode, setMode] = useState('login'); // login | register
  const [loginStep, setLoginStep] = useState('credentials'); // credentials | otp
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [csrf, setCsrf] = useState('');
  const [msg, setMsg] = useState('');
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    getCsrfToken()
      .then(setCsrf)
      .catch(() => setCsrf(''));
  }, []);

  function clearLoginState() {
    setLoginStep('credentials');
    setOtp('');
    setErrors({});
  }

  function validateRegister() {
    const errs = {};
    if (!firstName.trim()) errs.firstName = 'First name required';
    if (!lastName.trim()) errs.lastName = 'Last name required';
    if (!email.trim()) errs.email = 'Email required';
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errs.email = 'Invalid email';
    if (!password) errs.password = 'Password required';
    else if (password.length < 12) errs.password = 'Password must be at least 12 characters';
    return errs;
  }

  async function doRegister() {
    const errs = validateRegister();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setMsg('');
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);
      await api('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ firstName, lastName, email, password })
      });
      setMsg('Registered. You can login now.');
      setMode('login');
    } catch (e) {
      setMsg(e.message);
    }
  }

  function validateLogin() {
    const errs = {};
    if (!email.trim()) errs.email = 'Email required';
    if (!password) errs.password = 'Password required';
    return errs;
  }

  function validateOtp() {
    const errs = {};
    if (!otp.trim()) errs.otp = 'OTP is required';
    else if (!/^[0-9]{6}$/.test(otp)) errs.otp = 'Enter the 6-digit code';
    return errs;
  }

  async function doLogin() {
    const errs = validateLogin();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    try {
      setMsg('');
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);
      const result = await api('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ email, password })
      });

      if (result.otpRequired) {
        setLoginStep('otp');
        setMsg(`A verification code was sent to ${email}. Enter it below.`);
        return;
      }

      await onLoggedIn({ masterPassword: password });
      setPassword('');
    } catch (e) {
      setMsg(e.message);
    }
  }

  async function doVerifyOtp() {
    const errs = validateOtp();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    try {
      setMsg('');
      const csrfToken = csrf || (await getCsrfToken());
      setCsrf(csrfToken);
      await api('/api/auth/login/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
        body: JSON.stringify({ email, otp })
      });
      await onLoggedIn({ masterPassword: password });
      setOtp('');
      setPassword('');
      clearLoginState();
    } catch (e) {
      setMsg(e.message);
    }
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, maxWidth: 420, margin: '40px auto', background: '#fff', color: '#222', borderRadius: 12, boxShadow: '0 2px 12px #0002', padding: 32 }}>
      {msg ? (
        <div style={{ padding: 12, border: '1px solid #e0e0e0', borderRadius: 8, background: '#ffeaea', color: '#b00', marginBottom: 8 }}>
          {msg}
        </div>
      ) : null}

      {mode === 'register' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="First name" value={firstName} onChange={setFirstName} autoComplete="given-name" error={errors.firstName} />
          <Field label="Last name" value={lastName} onChange={setLastName} autoComplete="family-name" error={errors.lastName} />
        </div>
      ) : null}

      <Field
        label="Email"
        value={email}
        onChange={setEmail}
        autoComplete="email"
        error={errors.email}
        disabled={mode === 'login' && loginStep === 'otp'}
      />

      {mode === 'register' || loginStep === 'credentials' ? (
        <Field
          label={mode === 'register' ? 'Master password (min 12 chars)' : 'Master password'}
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={setPassword}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          error={errors.password}
          right={
            <button type="button" onClick={() => setShowPassword((v) => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, padding: 0 }}>
              {showPassword ? 'Hide' : 'Show'}
            </button>
          }
          disabled={mode === 'login' && loginStep === 'otp'}
        />
      ) : null}

      {mode === 'login' && loginStep === 'otp' ? (
        <Field
          label="Email OTP"
          value={otp}
          onChange={setOtp}
          error={errors.otp}
          autoComplete="one-time-code"
        />
      ) : null}

      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {mode === 'login' ? (
          loginStep === 'otp' ? (
            <>
              <Button onClick={doVerifyOtp}>Verify OTP</Button>
              <Button
                onClick={() => {
                  clearLoginState();
                  setMsg('');
                }}
                style={{ opacity: 0.9, background: '#f5f5f5', color: '#222' }}
              >
                Back
              </Button>
            </>
          ) : (
            <>
              <Button onClick={doLogin}>Login</Button>
              <Button onClick={() => { setMode('register'); clearLoginState(); setMsg(''); }} style={{ opacity: 0.9, background: '#f5f5f5', color: '#222' }}>
                Register
              </Button>
            </>
          )
        ) : (
          <>
            <Button onClick={doRegister}>Create account</Button>
            <Button onClick={() => { setMode('login'); clearLoginState(); setMsg(''); }} style={{ opacity: 0.9, background: '#f5f5f5', color: '#222' }}>
              Back
            </Button>
          </>
        )}
      </div>

      <div style={{ fontSize: 12, opacity: 0.8, lineHeight: 1.4, marginTop: 8 }}>
        <span style={{ color: '#888' }}>Note: Vault entries are encrypted in the browser. The server stores only ciphertext.</span>
      </div>
    </div>
  );
}

