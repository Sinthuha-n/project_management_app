import { useState, useEffect } from 'react';
import api from '../api/axios';
import { buildCreateProjectRequest, createProject as createProjectBuilder, type CreateProjectRequest } from '@planora/contracts';

export type ProjectType = 'AGILE' | 'KANBAN';
export type TeamOption = 'NEW' | 'EXISTING';
export type InviteRole = 'ADMIN' | 'MEMBER' | 'VIEWER';

// ─── Project Setup ────────────────────────────────────────────────────────────

export interface ProjectSetupState {
  projectName: string;
  projectKey: string;
  description: string;
  teamOption: TeamOption;
  teamName: string;
  // validation
  errors: Record<string, boolean>;
  serverError: string | null;
  projectKeyInlineError: string | null;
  isKeyValid: boolean | null;
  isTeamValid: boolean | null;
  checkingKey: boolean;
  checkingTeam: boolean;
  loading: boolean;
}

export function generateProjectKey(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 10);
}

export function useProjectSetup(projectType: ProjectType) {
  const [projectName, setProjectName] = useState('');
  const [projectKey, setProjectKey] = useState('');
  const [isKeyManuallyEdited, setIsKeyManuallyEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [teamOption, setTeamOption] = useState<TeamOption>('NEW');
  const [teamName, setTeamName] = useState('');

  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [projectKeyInlineError, setProjectKeyInlineError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [isKeyValid, setIsKeyValid] = useState<boolean | null>(null);
  const [isTeamValid, setIsTeamValid] = useState<boolean | null>(null);
  const [checkingKey, setCheckingKey] = useState(false);
  const [checkingTeam, setCheckingTeam] = useState(false);

  // Debounced project key availability check
  useEffect(() => {
    if (projectKey.trim().length < 3) { setIsKeyValid(null); return; }
    const timer = setTimeout(async () => {
      setCheckingKey(true);
      try {
        const res = await api.get(`/api/projects/check-key?key=${projectKey.trim()}`);
        setIsKeyValid(res.data);
      } catch {
        setIsKeyValid(null);
      } finally {
        setCheckingKey(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [projectKey]);

  // Debounced team validation
  useEffect(() => {
    if (teamName.trim().length === 0) { setIsTeamValid(null); return; }
    const timer = setTimeout(async () => {
      setCheckingTeam(true);
      try {
        const res = await api.get(`/api/teams/check-name?name=${teamName.trim()}`);
        const { exists, isMember } = res.data;
        setIsTeamValid(teamOption === 'NEW' ? !exists : exists && isMember);
      } catch {
        setIsTeamValid(null);
      } finally {
        setCheckingTeam(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [teamName, teamOption]);

  const handleProjectNameChange = (name: string) => {
    setProjectName(name);
    if (!isKeyManuallyEdited) {
      setProjectKey(generateProjectKey(name));
      setProjectKeyInlineError(null);
    }
  };

  const handleProjectKeyChange = (raw: string) => {
    const sanitized = raw
      .toUpperCase()
      .replace(/[^A-Z0-9-]+/g, '-')
      .slice(0, 10);
    setProjectKey(sanitized);
    setIsKeyManuallyEdited(sanitized.length > 0);
    if (errors.projectKey) setErrors(prev => ({ ...prev, projectKey: false }));
    setProjectKeyInlineError(null);
  };

  const handleTeamOptionChange = (opt: TeamOption) => {
    setTeamOption(opt);
    setIsTeamValid(null);
    setTeamName('');
  };

  // Returns { projectId } on success, throws on error
  const submit = async (): Promise<{ projectId: number; teamIsNew: boolean }> => {
    setServerError(null);
    setProjectKeyInlineError(null);

    const newErrors: Record<string, boolean> = {};
    if (!projectName.trim()) newErrors.projectName = true;
    if (!projectKey.trim() || isKeyValid === false) newErrors.projectKey = true;
    if (!teamName.trim() || isTeamValid === false) newErrors.teamName = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      throw new Error('VALIDATION_FAILED');
    }

    setLoading(true);
    try {
      const request: CreateProjectRequest = buildCreateProjectRequest({
        name: projectName,
        projectKey,
        description,
        teamOption,
        teamName,
        type: projectType,
      });
      const res = await createProjectBuilder(api, request);
      return { projectId: res.data.id, teamIsNew: teamOption === 'NEW' };
    } catch (err: any) {
      if (err?.response?.status === 409) {
        const base = projectKey || generateProjectKey(projectName) || 'PROJECT';
        const suggested = `${base.slice(0, 8)}-1`.slice(0, 10);
        setProjectKeyInlineError(`Key taken, try: ${suggested}`);
        setErrors(prev => ({ ...prev, projectKey: true }));
        throw new Error('KEY_CONFLICT');
      }
      const msg = err?.response?.data?.message || err?.response?.data || 'Failed to create project';
      setServerError(String(msg));
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  return {
    projectName, setProjectName: handleProjectNameChange,
    projectKey, setProjectKey: handleProjectKeyChange,
    description, setDescription,
    teamOption, setTeamOption: handleTeamOptionChange,
    teamName, setTeamName: (v: string) => {
      setTeamName(v.replace(/\s/g, '_'));
      if (errors.teamName) setErrors(prev => ({ ...prev, teamName: false }));
    },
    errors, setErrors,
    serverError,
    projectKeyInlineError,
    isKeyValid, isTeamValid,
    checkingKey, checkingTeam,
    loading,
    submit,
  };
}

// ─── Invite Members ───────────────────────────────────────────────────────────

const EMAIL_REGEX = /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/;

export function useInviteMembers(projectId: number | null) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<InviteRole>('MEMBER');
  const [loading, setLoading] = useState(false);
  const [statusType, setStatusType] = useState<'success' | 'error' | null>(null);
  const [statusText, setStatusText] = useState('');

  const canInvite = Boolean(projectId && email.trim());

  const sendInvite = async () => {
    setStatusType(null);
    const trimmed = email.trim().toLowerCase();

    if (!projectId) {
      setStatusType('error');
      setStatusText('Project ID not found.');
      return;
    }
    if (!trimmed) {
      setStatusType('error');
      setStatusText('Please enter an email address.');
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setStatusType('error');
      setStatusText('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      await api.post(`/api/projects/${projectId}/invitations`, { email: trimmed, role });
      setStatusType('success');
      setStatusText('Invitation sent successfully.');
      setEmail('');
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ||
        (typeof err?.response?.data === 'string' ? err.response.data : 'Failed to send invitation.');
      setStatusType('error');
      setStatusText(String(msg));
    } finally {
      setLoading(false);
    }
  };

  return {
    email, setEmail,
    role, setRole,
    loading,
    canInvite,
    statusType, statusText,
    sendInvite,
  };
}
