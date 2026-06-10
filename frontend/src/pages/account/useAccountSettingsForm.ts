import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/authCtx';
import type { OnboardingEducationEntry, OnboardingWorkEntry } from '@/context/AuthContext';
import type { Profile } from '@/types';
import { profileApi } from '@/services/api';
import { normalizeUrl } from '@/lib/normalizeUrl';
import {
  defaultSettingsForm,
  profileToSettingsForm,
  remotePolicyToWorkSettings,
  settingsFormToPayload,
  type SettingsFormState,
} from '@/lib/settingsProfileForm';
import { getUserFacingErrorMessage } from '@/lib/userFacingError';
import { useFiltersMutation, useProfileQuery } from '@/hooks/queries';
import { queryKeys } from '@/lib/queryKeys';

export function useAccountSettingsForm() {
  const { user, setUser } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<SettingsFormState>(() => defaultSettingsForm(user));
  const [profileLoadFailed, setProfileLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cvUploading, setCvUploading] = useState(false);
  const [portfolioBusy, setPortfolioBusy] = useState(false);
  const filtersMutation = useFiltersMutation();

  const {
    data: profileData,
    isError: profileQueryError,
    refetch: refetchProfile,
  } = useProfileQuery({ enabled: Boolean(user?.id) });

  const patch = useCallback((p: Partial<SettingsFormState>) => {
    setForm(prev => ({ ...prev, ...p }));
  }, []);

  const restoreForm = useCallback((state: SettingsFormState) => {
    setForm(state);
  }, []);

  useEffect(() => {
    setForm(prev => ({
      ...prev,
      name: user?.name ?? prev.name,
      email: user?.email ?? prev.email,
    }));
  }, [user?.name, user?.email]);

  useEffect(() => {
    if (profileData) {
      setForm(profileToSettingsForm(profileData, user));
      setProfileLoadFailed(false);
    }
  }, [profileData, user?.id, user?.name, user?.email]);

  useEffect(() => {
    if (profileQueryError) {
      setProfileLoadFailed(true);
      setForm(defaultSettingsForm(user));
      toast.error("Couldn't fetch your profile data.");
    }
  }, [profileQueryError, user]);

  const reloadProfile = useCallback(async () => {
    setProfileLoadFailed(false);
    try {
      const result = await refetchProfile();
      if (result.data) {
        setForm(profileToSettingsForm(result.data, user));
      } else if (result.isError) {
        setProfileLoadFailed(true);
        setForm(defaultSettingsForm(user));
        toast.error("Couldn't fetch your profile data.");
      }
    } catch {
      setProfileLoadFailed(true);
      setForm(defaultSettingsForm(user));
      toast.error("Couldn't fetch your profile data.");
    }
  }, [refetchProfile, user]);

  const handleSave = async (): Promise<boolean> => {
    if (!form.name.trim()) {
      toast.error('Please enter your name.');
      return false;
    }
    const hasWorkSetting =
      form.workSettings.remote || form.workSettings.onsite || form.workSettings.hybrid;
    if (form.workTypes.length === 0 || !hasWorkSetting) {
      toast.error('Select at least one work type and work setting.');
      return false;
    }
    setSaving(true);
    try {
      const payload = settingsFormToPayload(form);
      // #region agent log
      fetch('http://127.0.0.1:7839/ingest/bb7fc4ba-6f0e-4fdc-8dec-2d763bd17bfa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d86187'},body:JSON.stringify({sessionId:'d86187',hypothesisId:'H1,H4',location:'useAccountSettingsForm.ts:handleSave:pre',message:'Save payload work settings',data:{formWorkSettings:form.workSettings,payloadRemotePolicy:payload.remotePolicy,payloadOpenToRemote:payload.openToRemote},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      const savedProfile = await filtersMutation.mutateAsync(payload);
      const restored = profileToSettingsForm(savedProfile, user);
      // #region agent log
      fetch('http://127.0.0.1:7839/ingest/bb7fc4ba-6f0e-4fdc-8dec-2d763bd17bfa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d86187'},body:JSON.stringify({sessionId:'d86187',hypothesisId:'H1,H3',location:'useAccountSettingsForm.ts:handleSave:post',message:'Save response work settings',data:{savedRemotePolicy:savedProfile.remotePolicy,restoredWorkSettings:restored.workSettings,roundTripViaPolicy:remotePolicyToWorkSettings(savedProfile.remotePolicy)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      setForm(restored);
      setProfileLoadFailed(false);
      if (payload.name?.trim() && user) {
        setUser({ ...user, name: payload.name.trim() });
      }
      toast.success('Settings saved.');
      return true;
    } catch (err) {
      const status = (err as { response?: { status?: number } }).response?.status;
      const normalizedMessage = (err as { normalizedMessage?: string }).normalizedMessage;
      // #region agent log
      fetch('http://127.0.0.1:7839/ingest/bb7fc4ba-6f0e-4fdc-8dec-2d763bd17bfa',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'d86187'},body:JSON.stringify({sessionId:'d86187',hypothesisId:'H2',location:'useAccountSettingsForm.ts:handleSave:error',message:'Save failed',data:{status,normalizedMessage},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (status === 409) {
        toast.error('Profile was updated elsewhere. Refreshing…');
        await reloadProfile();
      } else {
        toast.error(getUserFacingErrorMessage(err, "Couldn't save your settings."));
      }
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleCvUpload = async (file: File) => {
    setCvUploading(true);
    try {
      const result = await profileApi.uploadCv(file);
      queryClient.setQueryData<Profile>(queryKeys.profile.current(), prev =>
        prev
          ? { ...prev, activeCvFileName: result.fileName, activeCvId: result.id }
          : prev,
      );
      setForm(prev => ({
        ...prev,
        activeCvFileName: result.fileName,
        activeCvId: result.id,
      }));
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

  const refreshPortfolioFromProfile = useCallback(async () => {
    const profile = await profileApi.get();
    setForm(profileToSettingsForm(profile, user));
  }, [user]);

  const portfolioDraftToBody = (draft: {
    title: string;
    url: string;
    description: string;
    location: string;
    techTags: string;
  }) => {
    const link = draft.url.trim();
    const techTags = draft.techTags
      .split(/[,;|/]/)
      .map(t => t.trim())
      .filter(Boolean);
    return {
      title: draft.title.trim(),
      ...(link ? { url: normalizeUrl(link) } : {}),
      ...(draft.description.trim() ? { description: draft.description.trim() } : {}),
      ...(draft.location.trim() ? { location: draft.location.trim() } : {}),
      ...(techTags.length > 0 ? { techTags } : {}),
    };
  };

  const addPortfolioItem = async (draft: {
    title: string;
    url: string;
    description: string;
    location: string;
    techTags: string;
  }) => {
    setPortfolioBusy(true);
    try {
      await profileApi.addPortfolioItem(portfolioDraftToBody(draft));
      await refreshPortfolioFromProfile();
      toast.success('Project added.');
    } catch {
      toast.error('Could not add project.');
    } finally {
      setPortfolioBusy(false);
    }
  };

  const updatePortfolioItem = async (
    itemId: string,
    draft: {
      title: string;
      url: string;
      description: string;
      location: string;
      techTags: string;
    },
  ) => {
    setPortfolioBusy(true);
    try {
      await profileApi.updatePortfolioItem(itemId, portfolioDraftToBody(draft));
      await refreshPortfolioFromProfile();
      toast.success('Project updated.');
    } catch {
      toast.error('Could not update project.');
    } finally {
      setPortfolioBusy(false);
    }
  };

  const removePortfolioItem = async (itemId: string) => {
    setPortfolioBusy(true);
    try {
      await profileApi.deletePortfolioItem(itemId);
      await refreshPortfolioFromProfile();
      toast.success('Project removed.');
    } catch {
      toast.error('Could not remove project.');
    } finally {
      setPortfolioBusy(false);
    }
  };

  return {
    user,
    form,
    patch,
    restoreForm,
    profileLoadFailed: profileLoadFailed || profileQueryError,
    saving,
    cvUploading,
    filtersMutation,
    handleSave,
    reloadProfile,
    handleCvUpload,
    handleCvDownload,
    updateWork,
    updateEducation,
    portfolioBusy,
    addPortfolioItem,
    updatePortfolioItem,
    removePortfolioItem,
  };
}
