import { useState } from 'react'
import type { User } from '../../api/auth.api'

export function UserAvatar({ user, size = 'medium' }: { user?: User | null; size?: 'small' | 'medium' | 'large' }) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | undefined>()
  const imageUrl = user?.profile?.imageUrl ?? undefined
  const showImage = Boolean(imageUrl && failedImageUrl !== imageUrl)

  return (
    <span className={`user-avatar ${size}`}>
      {showImage ? (
        <img
          src={imageUrl}
          alt=""
          onError={() => setFailedImageUrl(imageUrl)}
        />
      ) : (
        user?.profile?.initials ?? user?.name?.slice(0, 1).toUpperCase() ?? '?'
      )}
    </span>
  )
}
