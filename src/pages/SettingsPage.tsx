import { useRef, useState, type FormEvent } from 'react'
import { Check, Eye, EyeOff, ImagePlus, Moon, Sun, Loader2 } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { UserAvatar } from '../components/ui/UserAvatar'
import { useCurrentUser } from '../hooks/use-auth'
import { useChangePassword, useUploadProfileImage } from '../hooks/use-users'
import { useTheme } from '../hooks/use-theme'
import { useToastStore } from '../store/toast-store'
import { useBillingStatus, useCancelSubscription } from '../hooks/use-billing'
import { UpgradeModal } from '../components/billing/UpgradeModal'

type SettingsTab = 'profile' | 'security' | 'appearance' | 'billing'
const tabs: Array<{ id: SettingsTab; label: string; description: string }> = [
  { id: 'profile', label: 'Profile', description: 'Your identity across the workspace.' },
  { id: 'security', label: 'Security', description: 'Password and account protection.' },
  { id: 'appearance', label: 'Appearance', description: 'Theme and display preferences.' },
  { id: 'billing', label: 'Billing', description: 'Manage your subscription and payments.' },
]

export function SettingsPage() {
  const user = useCurrentUser(); 
  const upload = useUploadProfileImage(); 
  const password = useChangePassword(); 
  const { theme, setTheme } = useTheme(); 
  const show = useToastStore((state) => state.show); 
  const [params, setParams] = useSearchParams(); 
  const selected = params.get('tab') as SettingsTab; 
  const activeTab: SettingsTab = tabs.some((tab) => tab.id === selected) ? selected : 'profile'; 
  const [preview, setPreview] = useState(''); 
  const [values, setValues] = useState({ currentPassword: '', newPassword: '', confirm: '' }); 
  const [visible, setVisible] = useState(false); 
  const input = useRef<HTMLInputElement>(null)
  
  const { data: billing, isLoading: loadingBilling } = useBillingStatus()
  const cancelSub = useCancelSubscription()
  const [showUpgradeModal, setShowUpgradeModal] = useState(false)

  function changeTab(tab: SettingsTab) { setParams({ tab }, { replace: true }) }
  
  async function changePhoto(file?: File) { 
    if (!file) return; 
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { 
      show('Choose a JPEG, PNG, or WebP image smaller than 5 MB.', 'error'); 
      return 
    }; 
    const url = URL.createObjectURL(file); 
    setPreview(url); 
    try { 
      await upload.mutateAsync(file); 
      show('Profile photo updated.', 'success') 
    } catch (error) { 
      URL.revokeObjectURL(url); 
      setPreview(''); 
      show(error instanceof Error ? error.message : 'Photo upload failed.', 'error') 
    } 
  }
  
  async function submit(event: FormEvent) { 
    event.preventDefault(); 
    if (values.newPassword !== values.confirm) { 
      show('New passwords do not match.', 'error'); 
      return 
    }; 
    try { 
      await password.mutateAsync({ currentPassword: values.currentPassword, newPassword: values.newPassword }); 
      setValues({ currentPassword: '', newPassword: '', confirm: '' }); 
      show('Password updated.', 'success') 
    } catch (error) { 
      show(error instanceof Error && error.message.toLowerCase().includes('current password') ? 'The current password you entered is incorrect.' : error instanceof Error ? error.message : 'Password update failed.', 'error') 
    } 
  }
  
  const displayUser = preview && user.data ? { ...user.data, profile: { ...user.data.profile, imageUrl: preview } } : user.data
  
  return (
    <>
      <div className="workspace-content settings-content">
        <header className="settings-title">
          <p className="eyebrow">Preferences</p>
          <h1>Settings</h1>
          <p className="muted">Manage your profile, security, and appearance.</p>
        </header>
        <div className="settings-tabs" role="tablist" aria-label="Settings sections">
          {tabs.map((tab) => (
            <button key={tab.id} role="tab" aria-selected={activeTab === tab.id} className={activeTab === tab.id ? 'settings-tab active' : 'settings-tab'} onClick={() => changeTab(tab.id)}>
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </div>
        <section className="settings-panel">
          {activeTab === 'profile' && (
            <div className="settings-panel-content">
              <div className="panel-heading"><h2>Profile</h2><p className="muted">Your public account information.</p></div>
              <div className="profile-card">
                <UserAvatar user={displayUser} size="large" />
                <div>
                  <h3>{user.data?.name}</h3>
                  <p className="muted">{user.data?.email}</p>
                  <button className="toolbar-button bordered photo-button" disabled={upload.isPending} onClick={() => input.current?.click()}>
                    <ImagePlus size={15} />{upload.isPending ? 'Uploading…' : 'Change photo'}
                  </button>
                  <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void changePhoto(event.target.files?.[0])} />
                </div>
              </div>
            </div>
          )}
          {activeTab === 'security' && (
            <div className="settings-panel-content">
              <div className="panel-heading"><h2>Change password</h2><p className="muted">Update the password used to protect your account.</p></div>
              <form className="settings-form" onSubmit={(event) => void submit(event)}>
                {(['currentPassword', 'newPassword', 'confirm'] as const).map((field) => (
                  <label className="field-label" key={field}>
                    {field === 'currentPassword' ? 'Current password' : field === 'newPassword' ? 'New password' : 'Confirm new password'}
                    <span className="password-field">
                      <input className="text-input" required minLength={8} type={visible ? 'text' : 'password'} value={values[field]} onChange={(event) => setValues({ ...values, [field]: event.target.value })} />
                      <button type="button" className="icon-button" aria-label="Toggle password visibility" onClick={() => setVisible((value) => !value)}>
                        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </span>
                  </label>
                ))}
                <button className="primary-button" disabled={password.isPending}>{password.isPending ? 'Updating…' : 'Update password'}</button>
              </form>
            </div>
          )}
          {activeTab === 'appearance' && (
            <div className="settings-panel-content">
              <div className="panel-heading"><h2>Theme</h2><p className="muted">Choose how PDF Editor looks on this device.</p></div>
              <div className="theme-cards">
                <button className={theme === 'light' ? 'theme-card selected' : 'theme-card'} onClick={(event) => setTheme('light', event.currentTarget)}>
                  <div className="theme-preview light-preview"><Sun size={18} /></div>
                  <strong>Light</strong><span>Bright and calm</span>
                  {theme === 'light' && <Check className="theme-check" size={16} />}
                </button>
                <button className={theme === 'dark' ? 'theme-card selected' : 'theme-card'} onClick={(event) => setTheme('dark', event.currentTarget)}>
                  <div className="theme-preview dark-preview"><Moon size={18} /></div>
                  <strong>Graphite Dark</strong><span>Soft and focused</span>
                  {theme === 'dark' && <Check className="theme-check" size={16} />}
                </button>
              </div>
            </div>
          )}
          {activeTab === 'billing' && (
            <div className="settings-panel-content">
              <div className="panel-heading"><h2>Billing & Subscription</h2><p className="muted">Manage your Pro plan and payment methods.</p></div>
              
              <div className="rounded-xl border p-6">
                {loadingBilling ? (
                  <div className="flex items-center gap-2 text-gray-500">
                    <Loader2 className="animate-spin" size={16} />
                    <span>Loading billing information...</span>
                  </div>
                ) : billing?.hasActiveSubscription ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-green-600">
                      <Check size={20} />
                      <span className="font-semibold text-lg">Pro Plan Active</span>
                    </div>
                    {billing.subscription && (
                      <div className="space-y-2 text-sm text-gray-600">
                        <p>Status: <span className="capitalize font-medium">{billing.subscription.status}</span></p>
                        <p>Current Period Ends: <span className="font-medium">{new Date(billing.subscription.currentPeriodEnd).toLocaleDateString()}</span></p>
                        <p>Auto-renew: <span className="font-medium">{billing.subscription.cancelAtPeriodEnd ? 'Off (Cancels at end of period)' : 'On'}</span></p>
                      </div>
                    )}
                    
                    {!billing.subscription?.cancelAtPeriodEnd && (
                      <button 
                        onClick={() => {
                          if (confirm('Are you sure you want to cancel your subscription? You will keep Pro access until the end of your billing period.')) {
                            cancelSub.mutate(undefined, {
                              onSuccess: () => show('Subscription cancelled', 'success'),
                              onError: (err: any) => show(err.message || 'Failed to cancel', 'error')
                            })
                          }
                        }}
                        disabled={cancelSub.isPending}
                        className="mt-4 rounded border border-red-200 text-red-600 px-4 py-2 hover:bg-red-50 disabled:opacity-50 text-sm font-medium"
                      >
                        {cancelSub.isPending ? 'Cancelling...' : 'Cancel Subscription'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold text-lg">Free Plan</h3>
                        <p className="text-sm text-gray-500">You are currently on the free plan.</p>
                      </div>
                      <button 
                        onClick={() => setShowUpgradeModal(true)}
                        className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
      {showUpgradeModal && <UpgradeModal onClose={() => setShowUpgradeModal(false)} />}
    </>
  )
}
