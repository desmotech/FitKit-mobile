/**
 * Legacy route — announcements now live inside the unified inbox
 * (`/messages?tab=announcements`). This alias keeps old push-notification
 * deep links and any stored `/announcements` routes working.
 */
import { Redirect } from 'expo-router';

export default function AnnouncementsRedirect() {
  return (
    <Redirect
      href={{ pathname: '/messages', params: { tab: 'announcements' } }}
    />
  );
}
