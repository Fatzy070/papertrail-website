import type { User } from '../../api/auth.api'
export function UserAvatar({ user, size = 'medium' }: { user?: User | null; size?: 'small' | 'medium' | 'large' }) { return <span className={`user-avatar ${size}`}>{user?.profile?.imageUrl ? <img src={user.profile.imageUrl} alt="" /> : user?.profile?.initials ?? user?.name?.slice(0, 1).toUpperCase() ?? '?'}</span> }
