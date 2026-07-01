import { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import PasswordField from '../components/PasswordField.jsx';
import {
  savePreferences, getPreferences,
  getLearnerProfileSummary,
  saveLearnerProfile, saveLearnerProfileSummary,
  deleteProfile, deleteProfileSummary,
} from '../../js/storage.js';
import { updateProfile } from '../../js/auth.js';
import * as orchestrator from '../../js/orchestrator.js';
import { syncInBackground } from '../lib/syncDebounce.js';
import { ensureProfileExists, mergeProfile } from '../lib/profileQueue.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

export default function Settings() {
  const { state, dispatch } = useApp();
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState(user?.name || state.preferences?.name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [profileSummary, setProfileSummary] = useState('');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordFeedback, setPasswordFeedback] = useState('');
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [nameFeedback, setNameFeedback] = useState('');
  const [usernameFeedback, setUsernameFeedback] = useState('');
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [optOut, setOptOut] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedSummary, setEditedSummary] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [privacyFeedback, setPrivacyFeedback] = useState('');

  useEffect(() => {
    (async () => {
      setProfileSummary(await getLearnerProfileSummary());
      const prefs = await getPreferences();
      setOptOut(!!prefs?.profileOptOut);
    })();
  }, []);

  const handleOptOutChange = async (next) => {
    setOptOut(next);
    const prefs = (await getPreferences()) || {};
    await savePreferences({ ...prefs, profileOptOut: next });
    syncInBackground('preferences');
    setPrivacyFeedback(next
      ? 'Personalization is off. The coach won’t build or use a profile of you.'
      : 'Personalization is on.');
  };

  const startEditProfile = () => {
    setEditedSummary(profileSummary || '');
    setEditing(true);
  };

  const saveEditedProfile = async () => {
    const trimmed = editedSummary.trim();
    await saveLearnerProfileSummary(trimmed);
    syncInBackground('profileSummary');
    setProfileSummary(trimmed);
    setEditing(false);
    setPrivacyFeedback('Your profile was updated.');
  };

  const deleteMyProfile = async () => {
    await deleteProfile();
    await deleteProfileSummary();
    syncInBackground('profile', 'profileSummary');
    setProfileSummary('');
    setEditing(false);
    setDeleteOpen(false);
    setPrivacyFeedback('Your profile data was deleted.');
  };

  const handleSaveUsername = async (e) => {
    e.preventDefault();
    const trimmed = username.trim();
    if (!trimmed) {
      setUsernameFeedback('Username is required');
      setTimeout(() => setUsernameFeedback(''), 2000);
      return;
    }
    try {
      await updateProfile({ username: trimmed });
      await refreshUser();
      setUsernameFeedback('Saved!');
    } catch (err) {
      setUsernameFeedback(err.message || 'Failed to update');
    }
    setTimeout(() => setUsernameFeedback(''), 2000);
  };

  const handleSaveName = async (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    const prefs = { ...state.preferences, name: trimmed };
    await savePreferences(prefs);
    dispatch({ type: 'SET_PREFERENCES', preferences: prefs });
    syncInBackground('preferences');

    try {
      await updateProfile({ name: trimmed });
      await refreshUser();
      setNameFeedback('Saved!');
    } catch (err) {
      setNameFeedback(err.message || 'Failed to update');
    }
    setTimeout(() => setNameFeedback(''), 2000);
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setPasswordFeedback('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback('Passwords do not match.');
      return;
    }
    setPasswordSubmitting(true);
    setPasswordFeedback('');
    try {
      await updateProfile({ password: newPassword });
      setNewPassword('');
      setConfirmPassword('');
      setPasswordFeedback('Password changed!');
    } catch (err) {
      setPasswordFeedback(err.message || 'Failed to change password');
    } finally {
      setPasswordSubmitting(false);
      setTimeout(() => setPasswordFeedback(''), 3000);
    }
  };

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <h2 className="text-xl font-semibold">User Settings</h2>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Email</span>
            <span className="text-sm">{user?.email || ''}</span>
          </div>

          <Separator />

          <form className="space-y-3" onSubmit={handleSaveUsername}>
            <div className="space-y-1.5">
              <Label htmlFor="account-username">Username</Label>
              <Input id="account-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <Button type="submit">Save</Button>
            {usernameFeedback && <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{usernameFeedback}</p>}
          </form>

          <Separator />

          <form className="space-y-3" onSubmit={handleSaveName}>
            <div className="space-y-1.5">
              <Label htmlFor="account-name">Name</Label>
              <Input id="account-name" type="text" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit">Save</Button>
            {nameFeedback && <p className="text-sm text-green-600" role="status" aria-live="polite">{nameFeedback}</p>}
          </form>

          <Separator />

          <form className="space-y-3" onSubmit={handleChangePassword}>
            <div className="space-y-1.5">
              <Label htmlFor="new-password">New Password</Label>
              <PasswordField
                id="new-password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                disabled={passwordSubmitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password">Confirm Password</Label>
              <PasswordField
                id="confirm-password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleChangePassword(e); } }}
                disabled={passwordSubmitting}
              />
            </div>
            <Button type="submit" disabled={passwordSubmitting}>
              {passwordSubmitting ? 'Changing...' : 'Change Password'}
            </Button>
            {passwordFeedback && <p className="text-sm text-muted-foreground" role="status" aria-live="polite">{passwordFeedback}</p>}
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle id="profile-heading">Your data &amp; privacy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              As you work through activities, the coach keeps a short <strong>learner
              profile</strong> — things like your experience level, goals, strengths, and
              what you&apos;re working on. It uses this to personalize its coaching.
            </p>
            <p>
              Your profile is stored with your account and your chat history, and is used
              <strong> only</strong> to help the coach support you. It is never sold or used for
              advertising. You&apos;re in control: you can view it, edit it, delete it, or turn
              off personalization at any time below.
            </p>
          </div>

          <Separator />

          {/* Opt out of tracking (GDPR) */}
          <div className="flex items-start gap-3">
            <input
              id="profile-opt-out"
              type="checkbox"
              checked={optOut}
              onChange={(e) => handleOptOutChange(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
            <Label htmlFor="profile-opt-out" className="text-sm font-normal leading-relaxed">
              <span className="font-medium">Turn off personalization.</span> The coach still
              works, but it won&apos;t build or use a profile of you. Your existing profile stays
              stored until you delete it below.
            </Label>
          </div>

          {!optOut && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium" id="profile-summary-heading">Your profile</h3>
                {editing ? (
                  <div className="space-y-2">
                    <Label htmlFor="profile-edit" className="sr-only">Edit your profile</Label>
                    <Textarea
                      id="profile-edit"
                      rows={6}
                      value={editedSummary}
                      onChange={(e) => setEditedSummary(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button onClick={saveEditedProfile}>Save</Button>
                      <Button variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="rounded-md bg-muted p-3 text-sm leading-relaxed" aria-labelledby="profile-summary-heading">
                      {profileSummary || <em className="text-muted-foreground">No profile yet. Complete an activity to build your profile.</em>}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant="outline" onClick={startEditProfile}>Edit</Button>
                      <Button variant="outline" onClick={() => setFeedbackOpen(true)}>Add Feedback</Button>
                    </div>
                  </>
                )}
              </div>
            </>
          )}

          <Separator />

          <div className="space-y-2">
            <Button
              variant="outline"
              className="text-destructive hover:text-destructive"
              onClick={() => setDeleteOpen(true)}
            >
              Delete my profile data
            </Button>
            <p className="text-xs text-muted-foreground">
              Permanently removes your stored learner profile. Your lessons and chat history are
              not affected.
            </p>
          </div>

          {privacyFeedback && (
            <p className="text-sm text-green-600" role="status" aria-live="polite">{privacyFeedback}</p>
          )}
        </CardContent>
      </Card>

      <ProfileFeedbackDialog
        open={feedbackOpen}
        onOpenChange={setFeedbackOpen}
        onDone={async () => {
          setProfileSummary(await getLearnerProfileSummary());
        }}
      />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your profile data?</DialogTitle>
            <DialogDescription>
              This permanently deletes the learner profile the coach has built about you. The
              coach will start fresh next time. This can&apos;t be undone. Your lessons and chat
              history are not affected.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={deleteMyProfile}
            >
              Delete my data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfileFeedbackDialog({ open, onOpenChange, onDone }) {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      const profile = await ensureProfileExists();
      const result = await orchestrator.updateProfileFromFeedback(profile, text.trim(), {
        lessonName: 'Settings', activityType: 'feedback', activityGoal: 'User-provided profile feedback',
      });
      if (result?.profile) {
        const merged = mergeProfile(profile, result.profile);
        await saveLearnerProfile(merged);
        if (result.summary) await saveLearnerProfileSummary(result.summary);
        syncInBackground('profile', 'profileSummary');
      }
      onOpenChange(false);
      setText('');
      if (onDone) onDone();
    } catch (e) {
      console.error('[plato] Profile feedback failed:', e?.message || e);
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Profile Feedback</DialogTitle>
          <DialogDescription>
            Share anything that seems inaccurate or missing -- your device, experience level, learning style, or anything else.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="profile-feedback-input" className="sr-only">Profile feedback</Label>
          <Textarea
            id="profile-feedback-input"
            rows={4}
            placeholder="e.g. I'm a complete beginner. I use a Chromebook and don't have admin access."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSubmit(); } }}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Updating...' : 'Submit'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
