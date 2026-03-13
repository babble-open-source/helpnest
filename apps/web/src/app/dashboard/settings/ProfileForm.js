'use client';
import { useState } from 'react';
export function ProfileForm({ name: initialName, demoMode }) {
    const [name, setName] = useState(initialName);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [status, setStatus] = useState('idle');
    const [errorMessage, setErrorMessage] = useState('');
    async function handleSave(e) {
        e.preventDefault();
        setErrorMessage('');
        const changingPassword = newPassword.length > 0 || confirmPassword.length > 0;
        if (changingPassword) {
            if (newPassword.length < 12) {
                setErrorMessage('New password must be at least 12 characters.');
                return;
            }
            if (newPassword !== confirmPassword) {
                setErrorMessage('New passwords do not match.');
                return;
            }
        }
        const body = {};
        if (name.trim() !== initialName)
            body.name = name.trim();
        if (changingPassword) {
            if (currentPassword)
                body.currentPassword = currentPassword;
            body.newPassword = newPassword;
        }
        if (Object.keys(body).length === 0) {
            setErrorMessage('No changes to save.');
            return;
        }
        setStatus('saving');
        try {
            const res = await fetch('/api/profile', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const data = await res.json();
                setErrorMessage(data.error ?? 'Save failed.');
                setStatus('error');
                return;
            }
            setStatus('saved');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
            setTimeout(() => setStatus('idle'), 2000);
        }
        catch {
            setErrorMessage('Network error. Please try again.');
            setStatus('error');
        }
    }
    return (<form onSubmit={handleSave} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink mb-1">Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} disabled={demoMode} className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 disabled:cursor-not-allowed" placeholder="Your full name"/>
      </div>

      {demoMode ? (<div className="pt-2 border-t border-border">
          <p className="text-sm text-muted">Profile changes are disabled in demo mode.</p>
        </div>) : (<div className="pt-2 border-t border-border">
          <p className="text-sm font-medium text-ink mb-3">Change password</p>
          <div className="space-y-3">
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">Current password</label>
              <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} autoComplete="current-password" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Leave blank if not set yet"/>
            </div>
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">New password</label>
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} autoComplete="new-password" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" placeholder="At least 12 characters"/>
            </div>
            <div suppressHydrationWarning>
              <label className="block text-sm text-ink mb-1">Confirm new password</label>
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" placeholder="Repeat new password"/>
            </div>
          </div>
        </div>)}

      {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}

      {!demoMode && (<div className="flex items-center gap-3 pt-1">
          <button type="submit" disabled={status === 'saving'} className="bg-ink text-cream px-4 py-2 rounded-lg text-sm hover:bg-ink/90 transition-colors disabled:opacity-50">
            {status === 'saving' ? 'Saving…' : 'Save changes'}
          </button>
          {status === 'saved' && <span className="text-sm text-green">Saved</span>}
          {status === 'error' && !errorMessage && (<span className="text-sm text-red-500">Save failed</span>)}
        </div>)}
    </form>);
}
