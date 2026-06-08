import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import type { OnboardingEducationEntry, OnboardingWorkEntry } from '@/context/AuthContext';
import { profileApi } from '@/services/api';
import {
  defaultSettingsForm,
  profileToSettingsForm,
  settingsFormToPayload,
  type SettingsFormState,
} from '@/lib/settingsProfileForm';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { useFiltersMutation } from '@/hooks/queries';
import { invalidatePipelineAfterProfileChange } from '@/hooks/queries/useJobs';

export function useAccountSettingsForm() {
  const { user, setUser } = useAuth();
  const [form, setForm] = useState<SettingsFormState>(() => defaultSettingsForm(user));
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const filtersMutation = useFiltersMutation();
  const profileRequestIdRef = useRef(0);

  const patch = useCallback((p: Partial<SettingsFormState>) => {
    setForm(prev => ({ ...prev, ...p }));
  }, []);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      name: user?.name ?? prev.name,
      email: user?.email ?? prev.email,
    }));
  }, [user?.name, user?.email]);

  useEffect(() => {
    const requestId = ++profileRequestIdRef.current;
    setProfileLoadFailed(false);
    profileApi
      .get()
      .then(profile => {
        if (requestId !== profileRequestIdRef.current) return;
        setForm(profileToSettingsForm(profile, user));
      })
      .catch(() => {
        if (requestId !== profileRequestIdRef.current) return;
        setProfileLoadFailed(true);
        setForm(defaultSettingsForm(user));
        toast.error("Couldn't fetch your profile data.");
      });
  }, [user?.id]);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Please enter your name.');
      return;
    }
    const hasWorkSetting =
      form.workSettings.remote || form.workSettings.onsite || form.workSettings.hybrid;
    if (form.workTypes.length === 0 || !hasWorkSetting) {
      toast.error('Select at least one work type and work setting.');
      return;
    }
    setSaving(true);
    try {
      const payload = settingsFormToPayload(form);
      const savedProfile = await filtersMutation.mutateAsync(payload);
      setForm(profileToSettingsForm(savedProfile, user));
      if (payload.name?.trim() && user) {
        setUser({ ...user, name: payload.name.trim() });
      }
      toast.success('Settings saved.');
    } catch (err) {
      toast.error(getUserFacingErrorMessage(err, "Couldn't save your settings."));
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (file: File) => {
    setCvUploading(true);
    try {
      await profileApi.uploadCv(file);
      const profile = await profileApi.get();
      setForm(profileToSettingsForm(profile, user));
      invalidatePipelineAfterProfileChange();
      toast.success('CV uploaded.');
    } catch {
      toast.error('CV upload failed.');
    } finally {
      setCvUploading(false);
    }
  };

  const handleCvDownload = async () => {
    try {
      const { url } = await profileApi.cvDownload();
      await profileApi.openCvDownload(url, form.activeCvFileName);
    } catch {
      toast.error('Could not download CV.');
    }
  };

  const updateWork = (index: number, p: Partial<OnboardingWorkEntry>) => {
    const next = [...form.workExperience];
    next[index] = { ...next[index]!, ...p };
    patch({ workExperience: next });
  };

  const updateEducation = (index: number, p: Partial<OnboardingEducationEntry>) => {
    const next = [...form.education];
    next[index] = { ...next[index]!, ...p };
    patch({ education: next });
  };

  return {
    user,
    form,
    patch,
    profileLoadFailed,
    saving,
    cvUploading,
    filtersMutation,
    handleSave,
    handleCvUpload,
    handleCvDownload,
    updateWork,
    updateEducation,
  };
}
