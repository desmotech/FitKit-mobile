/**
 * RTL direction context for form rendering.
 *
 * Forms have their own `locale` (he / en / ru) that is independent of
 * the member's app UI language. A Hebrew compliance form must render
 * RTL even if the member is using the English UI. So field renderers
 * should NOT read `useI18n().dir` — they should read the form's own
 * locale via this context.
 *
 * `<FormRenderer>` sets the provider based on `form.locale === 'he'`;
 * every field renderer + `<FieldShell>` consumes `useFormRTL()`.
 *
 * If a field renderer is rendered outside a `<FormRenderer>` (e.g. in
 * isolation for a Storybook story or a one-off compose surface), the
 * default value (false) is used, which renders LTR.
 */
import { createContext, type ReactNode, useContext } from 'react';

const FormRTLContext = createContext<boolean>(false);

export function FormRTLProvider({
  isRTL,
  children,
}: {
  isRTL: boolean;
  children: ReactNode;
}) {
  return (
    <FormRTLContext.Provider value={isRTL}>{children}</FormRTLContext.Provider>
  );
}

export function useFormRTL(): boolean {
  return useContext(FormRTLContext);
}
