import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Platform, Alert, Animated, Image, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { T } from '@/src/constants/tokens';
import { getValidToken, clearTokens } from '@/src/auth/storage';
import api from '@/src/api/axios';
import PasswordInput from '@/src/components/ui/PasswordInput';
import { validatePassword, getPasswordStrength } from '@/src/lib/validation';
import PasswordStrengthBar from '@/src/components/ui/PasswordStrengthBar';
import {
  clearGitHubAccountCache,
  fetchGitHubConnectionStatus,
  fetchGitHubUser,
  getSavedGitHubAccounts,
  saveGitHubAccount,
  type SavedGitHubAccount,
} from '@/src/services/githubMobileService';
import { connectGitHub, githubOAuthErrorMessage } from '@/src/services/githubOAuthCoordinator';
import { AccountPicker } from '@/src/components/github/GitHubModals';
import { routes } from '@/src/navigation/routes';
import {
  buildForgotPasswordRequest,
  buildResetPasswordRequest,
  forgotPassword as forgotPasswordBuilder,
  resetPassword as resetPasswordBuilder,
  type ForgotPasswordRequest,
  type ResetPasswordRequest,
} from '@planora/contracts';

// ─── Types (mirrors web useProfileData.ts UserResponse exactly) ───────────────

interface UserProfile {
  userId?: number;
  username: string;
  fullName: string | null;
  email: string;
  verified?: boolean;
  profilePicUrl: string | null;
  lastActive?: string | null;
  firstName: string | null;
  lastName: string | null;
  contactNumber: string | null;
  countryCode: string | null;
  jobTitle: string | null;
  company: string | null;
  position: string | null;
  bio: string | null;
  githubUsername: string | null;
  notifyDueDateReminders: boolean;
}

const BIO_MAX = 300;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton() {
  const anim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, [anim]);
  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <Animated.View style={[sk.wrap, { opacity: anim }]}>
        {/* Hero */}
        <View style={sk.hero}>
          <View style={sk.avatar} />
          <View style={sk.l1} />
          <View style={sk.l2} />
        </View>
        {/* Cards */}
        {[0, 1, 2].map(i => (
          <View key={i} style={sk.card}>
            <View style={sk.cardTitle} />
            <View style={sk.cardLine} />
            <View style={[sk.cardLine, { width: '60%' }]} />
          </View>
        ))}
      </Animated.View>
    </SafeAreaView>
  );
}

const sk = StyleSheet.create({
  wrap: { flex: 1, padding: 16, gap: 16 },
  hero: { alignItems: 'center', paddingVertical: 24, gap: 10 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#E5E7EB' },
  l1: { width: 140, height: 14, borderRadius: 7, backgroundColor: '#E5E7EB' },
  l2: { width: 100, height: 11, borderRadius: 5, backgroundColor: '#E5E7EB' },
  card: { backgroundColor: '#F3F4F6', borderRadius: 14, padding: 18, gap: 12 },
  cardTitle: { width: 80, height: 10, backgroundColor: '#E5E7EB', borderRadius: 5 },
  cardLine: { width: '100%', height: 40, backgroundColor: '#E5E7EB', borderRadius: 10 },
});

// ─── Reusable input ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, disabled = false, multiline = false,
}: {
  label: string; value: string; onChange?: (v: string) => void;
  placeholder?: string; disabled?: boolean; multiline?: boolean;
}) {
  return (
    <View style={field.wrap}>
      <Text style={field.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        accessibilityState={{ disabled }}
        style={[field.input, disabled && field.disabled, multiline && field.multi]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        editable={!disabled}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  );
}

const field = StyleSheet.create({
  wrap:    { gap: 5 },
  label:   { fontSize: 12, fontWeight: '600', color: '#344054', letterSpacing: 0.2 },
  input: {
    borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#101828', backgroundColor: '#FFFFFF', minHeight: 42,
  },
  disabled:{ backgroundColor: '#F9FAFB', color: '#6B7280' },
  multi:   { height: 100, paddingTop: 10 },
});

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <View style={sec.card}>
      <View style={sec.header}>
        {icon}
        <Text style={sec.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const sec = StyleSheet.create({
  card:   { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 18, gap: 14, borderWidth: 1, borderColor: '#E4E7EC', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6 }, android: { elevation: 2 } }) },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  title:  { fontSize: 11, fontWeight: '700', color: '#101828', textTransform: 'uppercase', letterSpacing: 1 },
});

// ─── Change Password inline section ──────────────────────────────────────────

function ChangePasswordSection({ email }: { email: string }) {
  const [step,     setStep]     = useState<'idle' | 'sent' | 'done'>('idle');
  const [otp,      setOtp]      = useState('');
  const [newPw,    setNewPw]    = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [sending,  setSending]  = useState(false);
  const [resetting,setResetting]= useState(false);
  const [msg,      setMsg]      = useState('');
  const [isErr,    setIsErr]    = useState(false);

  const showMsg = (txt: string, err = false) => { setMsg(txt); setIsErr(err); };

  const sendOtp = async () => {
    setSending(true);
    try {
      const request: ForgotPasswordRequest = buildForgotPasswordRequest({ email });
      await forgotPasswordBuilder(api, request);
      setStep('sent');
      showMsg('Reset code sent to your email.');
    } catch { showMsg('Failed to send reset code.', true); }
    finally { setSending(false); }
  };

  const resetPw = async () => {
    if (!otp.trim())       return showMsg('Enter the reset code.', true);
    
    const { valid, message } = validatePassword(newPw);
    if (!valid)            return showMsg(message, true);
    
    if (newPw !== confirm)  return showMsg('Passwords do not match.', true);
    
    setResetting(true);
    try {
      const request: ResetPasswordRequest = buildResetPasswordRequest({ email, token: otp.trim(), newPassword: newPw });
      await resetPasswordBuilder(api, request);
      setStep('done');
      showMsg('Password changed successfully!');
      setOtp('');
      setNewPw('');
      setConfirm('');
    } catch { showMsg('Failed to reset. Check your code.', true); }
    finally { setResetting(false); }
  };

  return (
    <SectionCard title="Change Password"
      icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Rect x={3} y={11} width={18} height={11} rx={2} /><Path d="M7 11V7a5 5 0 0 1 10 0v4" /></Svg>}
    >
      {msg !== '' && (
        <View style={[pw.alert, isErr ? pw.alertErr : pw.alertOk]}>
          <Text style={[pw.alertTxt, { color: isErr ? '#B91C1C' : '#15803D' }]}>{msg}</Text>
        </View>
      )}

      {step === 'idle' && (
        <TouchableOpacity style={pw.sendBtn} onPress={sendOtp} disabled={sending}>
          <Text style={pw.sendBtnTxt}>{sending ? 'Sending…' : 'Send Reset Code'}</Text>
        </TouchableOpacity>
      )}

      {step === 'sent' && (
        <View style={{ gap: 10 }}>
          <Field label="Reset Code" value={otp} onChange={setOtp} placeholder="Enter OTP from email" />
          <PasswordInput
            label="New Password"
            value={newPw}
            onChangeText={setNewPw}
            placeholder="Min 8 chars, upper, lower, digit, symbol"
          />
          {newPw.length > 0 && (
            <PasswordStrengthBar strength={getPasswordStrength(newPw)} password={newPw} />
          )}
          <PasswordInput
            label="Confirm Password"
            value={confirm}
            onChangeText={setConfirm}
            placeholder="Repeat new password"
          />
          <TouchableOpacity style={pw.sendBtn} onPress={resetPw} disabled={resetting}>
            <Text style={pw.sendBtnTxt}>{resetting ? 'Changing…' : 'Change Password'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {step === 'done' && (
        <TouchableOpacity onPress={() => { setStep('idle'); setMsg(''); }}>
          <Text style={{ fontSize: 13, color: T.primary, fontWeight: '600' }}>Change again →</Text>
        </TouchableOpacity>
      )}
    </SectionCard>
  );
}

const pw = StyleSheet.create({
  alert:    { padding: 10, borderRadius: 10, borderWidth: 1, marginBottom: 4 },
  alertErr: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertOk:  { backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },
  alertTxt: { fontSize: 13 },
  sendBtn:  { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  sendBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});

// ─── Main ProfileScreen ───────────────────────────────────────────────────────

export default function ProfileScreen() {
  const router = useRouter();

  const [profile,      setProfile]      = useState<UserProfile | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [saving,       setSaving]       = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [errMsg,       setErrMsg]       = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');

  // Editable fields (mirrors web useState fields)
  const [fullName,   setFullName]   = useState('');
  const [firstName,  setFirstName]  = useState('');
  const [lastName,   setLastName]   = useState('');
  const [jobTitle,   setJobTitle]   = useState('');
  const [company,    setCompany]    = useState('');
  const [position,   setPosition]   = useState('');
  const [bio,        setBio]        = useState('');
  const [phone,      setPhone]      = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [githubUsername, setGithubUsername] = useState<string | null>(null);
  const [notifyDueDateReminders, setNotifyDueDateReminders] = useState(false);

  // GitHub actions states
  const [githubLinking, setGithubLinking] = useState(false);
  const [githubUnlinking, setGithubUnlinking] = useState(false);
  const [githubAccounts, setGithubAccounts] = useState<SavedGitHubAccount[]>([]);
  const [githubAccountPicker, setGithubAccountPicker] = useState(false);
  const [loggingOutAll, setLoggingOutAll] = useState(false);

  // ── Load — mirrors web: GET /api/user/profile ─────────────────────────────
  const loadProfile = useCallback(async () => {
    const token = await getValidToken();
    if (!token) { router.replace('/(auth)/login'); return; }
    try {
      const res = await api.get<UserProfile>('/api/user/profile');
      const p = res.data;
      setProfile(p);
      setFullName(p.fullName ?? '');
      setFirstName(p.firstName ?? '');
      setLastName(p.lastName ?? '');
      setJobTitle(p.jobTitle ?? '');
      setCompany(p.company ?? '');
      setPosition(p.position ?? '');
      setBio(p.bio ?? '');
      setPhone(p.contactNumber ?? '');
      setCountryCode(p.countryCode ?? '');
      const githubStatus = await fetchGitHubConnectionStatus().catch(() => ({ connected: false, username: undefined }));
      setGithubUsername(githubStatus.connected ? (githubStatus.username ?? p.githubUsername ?? null) : null);
      setGithubAccounts(await getSavedGitHubAccounts());
      setNotifyDueDateReminders(p.notifyDueDateReminders ?? false);
    } catch { setErrMsg('Failed to load profile.'); }
    finally { setLoading(false); }
  }, [router]);

  useEffect(() => { void loadProfile(); }, [loadProfile]);

  // ── Save — mirrors web: PUT /api/user/profile/update ─────────────────────
  const handleSave = async () => {
    setErrMsg(''); setSuccessMsg('');
    setSaving(true);
    try {
      const res = await api.put<UserProfile>('/api/user/profile/update', {
        fullName:      fullName.trim()  || null,
        firstName:     firstName.trim() || null,
        lastName:      lastName.trim()  || null,
        contactNumber: phone.trim()     || null,
        countryCode:   countryCode.trim() || null,
        jobTitle:      jobTitle.trim()  || null,
        company:       company.trim()   || null,
        position:      position.trim()  || null,
        bio:           bio.trim()       || null,
        notifyDueDateReminders: notifyDueDateReminders,
      });
      const p = res.data;
      setProfile(p);
      setFullName(p.fullName ?? '');
      setFirstName(p.firstName ?? '');
      setLastName(p.lastName ?? '');
      setPhone(p.contactNumber ?? '');
      setCountryCode(p.countryCode ?? '');
      setNotifyDueDateReminders(p.notifyDueDateReminders ?? false);
      setSuccessMsg('Profile updated successfully.');
    } catch { setErrMsg('Failed to update profile.'); }
    finally { setSaving(false); }
  };

  // ── Photo upload — mirrors web: POST /api/user/profile/photo ─────────────
  const handlePickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission required', 'Allow photo library access.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.85 });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', { uri: asset.uri, type: 'image/jpeg', name: 'profile.jpg' } as unknown as Blob);
      const res = await api.post<{ success: boolean; fileUrl: string | null }>('/api/user/profile/photo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success && res.data.fileUrl) {
        setProfile(prev => prev ? { ...prev, profilePicUrl: res.data.fileUrl } : prev);
        setSuccessMsg('Profile photo updated.');
      }
    } catch { setErrMsg('Failed to upload photo.'); }
    finally { setUploading(false); }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => { await clearTokens(); router.replace('/(auth)/login'); } },
    ]);
  };

  const handleLinkGithub = async (loginHint?: string) => {
    setGithubAccountPicker(false);
    setGithubLinking(true);
    setErrMsg(''); setSuccessMsg('');
    try {
      const outcome = await connectGitHub({ destination: 'PROFILE', loginHint });
      if (outcome.type === 'success') {
        const status = await fetchGitHubConnectionStatus();
        setGithubUsername(status.connected ? (status.username ?? null) : null);
        const githubUser = await fetchGitHubUser();
        await saveGitHubAccount(githubUser);
        setGithubAccounts(await getSavedGitHubAccounts());
        await loadProfile();
        setSuccessMsg('GitHub account connected successfully.');
      } else if (outcome.type === 'error') {
        setErrMsg(githubOAuthErrorMessage(outcome.code));
      }
    } catch {
      setErrMsg('Failed to connect GitHub account.');
    } finally {
      setGithubLinking(false);
    }
  };

  const handleUnlinkGithub = async () => {
    Alert.alert('Disconnect GitHub', 'Are you sure you want to disconnect your GitHub account?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Disconnect', style: 'destructive', onPress: async () => {
        setGithubUnlinking(true);
        setErrMsg(''); setSuccessMsg('');
        try {
          await api.post('/api/github/revoke');
          await clearGitHubAccountCache();
          setGithubUsername(null);
          await loadProfile();
          setSuccessMsg('GitHub account unlinked successfully.');
        } catch {
          setErrMsg('Failed to unlink GitHub account.');
        } finally {
          setGithubUnlinking(false);
        }
      }}
    ]);
  };

  const handleLogoutAll = () => {
    Alert.alert('Sign Out All Sessions', 'This will log you out of all devices and active sessions. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out All', style: 'destructive', onPress: async () => {
        setLoggingOutAll(true);
        try {
          await api.post('/api/user/me/logout-all');
          await clearTokens();
          router.replace('/(auth)/login');
        } catch {
          Alert.alert('Error', 'Failed to log out of all sessions. Please try again.');
        } finally {
          setLoggingOutAll(false);
        }
      } },
    ]);
  };

  if (loading) return <Skeleton />;

  const displayName = fullName || profile?.username || 'User';
  const initials    = displayName.charAt(0).toUpperCase();
  const email       = profile?.email ?? '';

  return (
    <SafeAreaView style={s.safe} edges={['top', 'left', 'right']}>
      <StatusBar style="dark" />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Hero ── */}
        <View style={s.hero}>
          <TouchableOpacity style={s.avatarRing} onPress={handlePickPhoto} activeOpacity={0.85}>
            {profile?.profilePicUrl ? (
              <Image source={{ uri: profile.profilePicUrl }} style={s.avatarImg} />
            ) : (
              <View style={s.avatarFallback}>
                <Text style={s.avatarInitial}>{initials}</Text>
              </View>
            )}
            {/* Camera overlay */}
            <View style={s.cameraOverlay}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="#FFF" strokeWidth={2} strokeLinecap="round"><Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><Circle cx={12} cy={13} r={4} /></Svg>
            </View>
          </TouchableOpacity>
          <Text style={s.heroName}>{displayName}</Text>
          <Text style={s.heroEmail}>{email}</Text>
          {jobTitle !== '' && (
            <View style={s.rolePill}><Text style={s.roleTxt}>{jobTitle}</Text></View>
          )}
          {uploading && <Text style={s.uploadingTxt}>Uploading photo…</Text>}
        </View>

        {/* ── Alerts ── */}
        {errMsg !== '' && (
          <View style={s.alertErr}><Text style={{ color: '#B91C1C', fontSize: 13 }}>{errMsg}</Text></View>
        )}
        {successMsg !== '' && (
          <View style={s.alertOk}><Text style={{ color: '#15803D', fontSize: 13 }}>{successMsg}</Text></View>
        )}

        <View style={s.sections}>
          {/* Account (read-only) */}
          <SectionCard title="Account"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx={12} cy={7} r={4} /></Svg>}
          >
            <Field label="Username" value={profile?.username ?? ''} disabled />
            <Field label="Email" value={email} disabled />
            {profile?.lastActive && (
              <View style={s.lastActive}>
                <Text style={s.lastActiveLbl}>Last active: </Text>
                <Text style={s.lastActiveVal}>{new Date(profile.lastActive).toLocaleDateString()}</Text>
              </View>
            )}
          </SectionCard>

          {/* Basic info */}
          <SectionCard title="Basic Info"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><Circle cx={12} cy={7} r={4} /></Svg>}
          >
            <Field label="Full Name"   value={fullName}  onChange={setFullName}  placeholder="Your display name" />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field label="First Name" value={firstName} onChange={setFirstName} placeholder="First name" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Last Name"  value={lastName}  onChange={setLastName}  placeholder="Last name" />
              </View>
            </View>
          </SectionCard>

          {/* Contact */}
          <SectionCard title="Contact"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 13.5 19.79 19.79 0 0 1 1.6 4.9 2 2 0 0 1 3.59 2.72h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 10a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></Svg>}
          >
            <View style={s.row2}>
              <View style={{ width: 80 }}>
                <Field label="Code" value={countryCode} onChange={setCountryCode} placeholder="+1" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Phone Number" value={phone} onChange={setPhone} placeholder="(555) 000-0000" />
              </View>
            </View>
          </SectionCard>

          {/* Professional */}
          <SectionCard title="Professional"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Rect x={2} y={7} width={20} height={14} rx={2} /><Path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" /></Svg>}
          >
            <Field label="Job Title" value={jobTitle} onChange={setJobTitle} placeholder="e.g. Senior Engineer" />
            <View style={s.row2}>
              <View style={{ flex: 1 }}>
                <Field label="Company" value={company} onChange={setCompany} placeholder="Company name" />
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Department" value={position} onChange={setPosition} placeholder="e.g. Engineering" />
              </View>
            </View>
          </SectionCard>

          {/* Bio */}
          <SectionCard title="Bio">
            <TextInput
              style={bio_s.input}
              value={bio}
              onChangeText={v => setBio(v.slice(0, BIO_MAX))}
              placeholder="Tell your team a little about yourself…"
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Text style={bio_s.counter}>{bio.length}/{BIO_MAX}</Text>
          </SectionCard>

          {/* Preferences */}
          <SectionCard title="Preferences"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /><Circle cx={12} cy={12} r={4} /></Svg>}
          >
            <View style={s.preferenceRow}>
              <View style={{ flex: 1, paddingRight: 10 }}>
                <Text style={s.preferenceTitle}>Due-Date Reminders</Text>
                <Text style={s.preferenceDesc}>Receive alerts for due dates and overdue tasks.</Text>
              </View>
              <Switch
                value={notifyDueDateReminders}
                onValueChange={setNotifyDueDateReminders}
                trackColor={{ false: '#D1D5DB', true: T.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </SectionCard>

          {/* GitHub Integration */}
          <SectionCard title="GitHub Integration"
            icon={<Svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke={T.primary} strokeWidth={2} strokeLinecap="round"><Path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" /></Svg>}
          >
            {githubUsername ? (
              <View style={{ gap: 10 }}>
                <View style={s.githubConnected}>
                  <Text style={s.githubConnectedTxt}>Connected as </Text>
                  <Text style={s.githubUsernameTxt}>@{githubUsername}</Text>
                </View>
                <TouchableOpacity style={s.githubBtn} onPress={() => router.push(routes.githubSettings)}>
                  <Text style={s.githubBtnTxt}>Browse GitHub Repositories</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.githubBtn} onPress={() => githubAccounts.length ? setGithubAccountPicker(true) : void handleLinkGithub()} disabled={githubLinking}>
                  <Text style={s.githubBtnTxt}>{githubLinking ? 'Connecting…' : 'Switch GitHub Account'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.githubBtn, s.githubBtnUnlink]}
                  onPress={handleUnlinkGithub}
                  disabled={githubUnlinking}
                >
                  <Text style={s.githubBtnTxtUnlink}>{githubUnlinking ? 'Disconnecting…' : 'Disconnect Account'}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <Text style={s.preferenceDesc}>
                  Authorize Planora to access your repositories and verify your GitHub identity.
                </Text>
                <TouchableOpacity
                  style={s.githubBtn}
                  onPress={() => void handleLinkGithub()}
                  disabled={githubLinking}
                >
                  <Text style={s.githubBtnTxt}>{githubLinking ? 'Linking…' : 'Link GitHub Account'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </SectionCard>

          {/* Save button */}
          <TouchableOpacity
            style={[s.saveBtn, saving && s.saveBtnDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={s.saveBtnTxt}>{saving ? 'Saving…' : 'Save changes'}</Text>
          </TouchableOpacity>

          {/* Change password */}
          <ChangePasswordSection email={email} />

          {/* Sign out and revoke sessions */}
          <View style={{ gap: 10 }}>
            <TouchableOpacity style={s.signOutBtn} onPress={handleLogout}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round"><Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><Path d="M16 17l5-5-5-5M21 12H9" /></Svg>
              <Text style={s.signOutTxt}>Sign Out</Text>
            </TouchableOpacity>

            <TouchableOpacity style={s.logoutAllBtn} onPress={handleLogoutAll} disabled={loggingOutAll}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth={2} strokeLinecap="round"><Circle cx={12} cy={12} r={10} /><Path d="m15 9-6 6M9 9l6 6" /></Svg>
              <Text style={s.logoutAllTxt}>{loggingOutAll ? 'Signing out all...' : 'Sign Out All Sessions'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ height: 110 }} />
      </ScrollView>
      <AccountPicker
        visible={githubAccountPicker}
        accounts={githubAccounts}
        onClose={() => setGithubAccountPicker(false)}
        onSelect={login => void handleLinkGithub(login)}
        onAdd={() => void handleLinkGithub('')}
      />
    </SafeAreaView>
  );
}

const bio_s = StyleSheet.create({
  input:   { borderWidth: 1, borderColor: '#D0D5DD', borderRadius: 10, padding: 12, minHeight: 110, fontSize: 14, color: '#101828', backgroundColor: '#FFFFFF', textAlignVertical: 'top' },
  counter: { fontSize: 11, color: '#9CA3AF', textAlign: 'right', marginTop: 4 },
});

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { paddingBottom: 20 },

  hero: { alignItems: 'center', paddingVertical: 28, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 8 },
  avatarRing: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: T.primaryLight, position: 'relative', ...Platform.select({ ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 }, android: { elevation: 6 } }) },
  avatarImg:  { width: 84, height: 84, borderRadius: 42 },
  avatarFallback: { width: 84, height: 84, borderRadius: 42, backgroundColor: T.primary, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontSize: 32, fontWeight: '800', color: '#FFF' },
  cameraOverlay: { position: 'absolute', bottom: 2, right: 2, width: 26, height: 26, borderRadius: 13, backgroundColor: T.primary, borderWidth: 2, borderColor: '#FFF', alignItems: 'center', justifyContent: 'center' },
  heroName: { fontSize: 20, fontWeight: '800', color: '#101828', letterSpacing: -0.3 },
  heroEmail: { fontSize: 13, color: '#6B7280' },
  rolePill: { backgroundColor: T.primaryLight, paddingHorizontal: 12, paddingVertical: 3, borderRadius: 999 },
  roleTxt:  { fontSize: 11, fontWeight: '700', color: T.primary, textTransform: 'uppercase', letterSpacing: 0.8 },
  uploadingTxt: { fontSize: 12, color: T.primary },

  alertErr: { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  alertOk:  { marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' },

  sections: { padding: 16, gap: 16 },
  row2: { flexDirection: 'row', gap: 10 },
  lastActive: { flexDirection: 'row', paddingTop: 4 },
  lastActiveLbl: { fontSize: 12, color: '#9CA3AF' },
  lastActiveVal: { fontSize: 12, color: '#374151', fontWeight: '600' },

  saveBtn: { backgroundColor: T.primary, borderRadius: 12, paddingVertical: 13, alignItems: 'center', ...Platform.select({ ios: { shadowColor: T.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 }, android: { elevation: 4 } }) },
  saveBtnDisabled: { backgroundColor: '#93C5FD' },
  saveBtnTxt: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF5F5', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#FECACA' },
  signOutTxt: { fontSize: 14, fontWeight: '700', color: '#DC2626' },

  preferenceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 4 },
  preferenceTitle: { fontSize: 14, fontWeight: '600', color: '#101828' },
  preferenceDesc: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  githubConnected: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  githubConnectedTxt: { fontSize: 13, color: '#475569' },
  githubUsernameTxt: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  githubBtn: { backgroundColor: '#24292F', borderRadius: 12, paddingVertical: 12, alignItems: 'center', ...Platform.select({ ios: { shadowColor: '#24292F', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }, android: { elevation: 3 } }) },
  githubBtnTxt: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  githubBtnUnlink: { backgroundColor: '#FFF5F5', borderWidth: 1, borderColor: '#FECACA' },
  githubBtnTxtUnlink: { color: '#DC2626', fontSize: 14, fontWeight: '700' },

  logoutAllBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 13, borderWidth: 1, borderColor: '#E4E7EC', ...Platform.select({ ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3 }, android: { elevation: 1 } }) },
  logoutAllTxt: { fontSize: 14, fontWeight: '700', color: '#DC2626' },
});
