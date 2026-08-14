/**
 * Inbox strings for the member's locale, overlaying the shared runtime
 * dictionary where it already has copy for the merged surfaces (messages /
 * announcements) so the dictionary stays the source of truth when a key
 * exists and the local tables act as per-language fallbacks.
 */
import { useMemo } from 'react';
import { inboxStringsFor, type InboxStrings } from './inbox-strings';
import { useI18n } from '@/providers/i18n-provider';

type Dict = Record<string, Record<string, string> | undefined>;

export function useInboxStrings(): InboxStrings {
  const { lang, t } = useI18n();
  return useMemo(() => {
    const local = inboxStringsFor(lang);
    const dict = t as unknown as Dict;
    const messagesT = dict.messages ?? {};
    const annT = dict.announcements ?? {};
    const commonT = dict.common ?? {};
    return {
      ...local,
      noConversations: messagesT.noConversations ?? local.noConversations,
      newMessage: messagesT.newMessage ?? local.newMessage,
      noAnnouncements: annT.empty ?? local.noAnnouncements,
      noAnnouncementsHint: annT.emptyHint ?? local.noAnnouncementsHint,
      announcementsTitle: annT.title ?? local.announcementsTitle,
      tryAgain: commonT.tryAgain ?? local.tryAgain,
    };
  }, [lang, t]);
}
