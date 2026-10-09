import React from 'react';
import InstallPrompt from './InstallPrompt';
import UpdateBanner from './UpdateBanner';
import OfflineBadge from './OfflineBadge';
import WorkoutReminder from './WorkoutReminder';

// Monte uma vez dentro do AuthProvider (WorkoutReminder usa o usuário logado).
export default function PwaLayer() {
  return (
    <>
      <OfflineBadge />
      <UpdateBanner />
      <InstallPrompt />
      <WorkoutReminder />
    </>
  );
}
