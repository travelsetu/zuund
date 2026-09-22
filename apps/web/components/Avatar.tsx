import type { PublicUserDto } from '@zuund/shared';

export function Avatar({
  user,
  size,
}: {
  user: Pick<PublicUserDto, 'name' | 'photoUrl'>;
  size?: 'lg';
}) {
  const initial = (user.name ?? '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className={`avatar${size ? ` ${size}` : ''}`} aria-hidden>
      {user.photoUrl ? <img src={user.photoUrl} alt="" /> : initial}
    </span>
  );
}
