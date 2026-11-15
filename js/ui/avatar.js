// Reusable learner profile portrait with graceful fallback and subtle physiological breathing halo.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { SITE } from '../config.js';

export function createProfileAvatar({ size = 'md', breathing = false, label = 'Learner profile photo' } = {}) {
  const wrap = h(
    `span.profile-avatar.is-${size}` + (breathing ? '.is-breathing' : ''),
    h('span.profile-avatar-fallback', { 'aria-hidden': 'true' }, icon('user', size === 'sm' ? 14 : size === 'lg' ? 26 : 32))
  );

  if (SITE.profileAvatar) {
    const img = h('img.profile-avatar-img', {
      src: SITE.profileAvatar,
      alt: label,
      referrerpolicy: 'no-referrer',
      decoding: 'async',
      loading: 'eager',
    });
    img.addEventListener('error', () => {
      wrap.classList.add('is-fallback');
      img.remove();
    });
    wrap.appendChild(img);
  } else {
    wrap.classList.add('is-fallback');
  }

  return wrap;
}
