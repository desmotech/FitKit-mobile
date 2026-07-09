/**
 * Auth-flow localization — the sign-in screen's chrome: credentials
 * form, second-factor (MFA) step, and the native password-reset flow.
 *
 * Add a string: extend `AuthStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface AuthStrings {
  // ── Credentials stage ─────────────────────────────────────────────
  welcome: string;
  subtitle: string;
  email: string;
  emailPlaceholder: string;
  password: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  forgot: string;
  submit: string;
  submitting: string;
  invitedFooter: string;

  // ── Second factor (MFA) ───────────────────────────────────────────
  mfaTitle: string;
  mfaSubtitle: string;
  mfaCodeLabel: string;
  mfaCodePlaceholder: string;
  mfaSubmit: string;
  mfaSubmitting: string;
  mfaBack: string;
  mfaTotpDesc: string;
  mfaPhoneDesc: string;
  mfaEmailDesc: string;
  mfaBackupDesc: string;

  // ── Password reset ────────────────────────────────────────────────
  resetTitle: string;
  resetRequestDesc: string;
  resetVerifyDesc: string;
  resetSend: string;
  resetSending: string;
  resetCodeLabel: string;
  newPassword: string;
  resetSubmit: string;
  resetSubmitting: string;
  resetBack: string;

  // ── Friendly Clerk error translations ─────────────────────────────
  wrongCredentials: string;
  accountNotFound: string;
  passwordPwned: string;
}

const HE: AuthStrings = {
  welcome: 'ברוך שובך',
  subtitle: 'התחבר כדי להמשיך להתאמן',
  email: 'אימייל',
  emailPlaceholder: 'you@example.com',
  password: 'סיסמה',
  passwordPlaceholder: '••••••••',
  showPassword: 'הצג סיסמה',
  hidePassword: 'הסתר סיסמה',
  forgot: 'שכחת סיסמה?',
  submit: 'התחברות',
  submitting: 'מתחבר…',
  invitedFooter: 'חדש כאן? בקש מהמועדון לשלוח לך קישור הזמנה.',

  mfaTitle: 'אימות החשבון',
  mfaSubtitle: 'עוד שלב אחד כדי לשמור על החשבון שלך.',
  mfaCodeLabel: 'קוד אימות',
  mfaCodePlaceholder: '------',
  mfaSubmit: 'אימות',
  mfaSubmitting: 'מאמת…',
  mfaBack: 'שימוש בחשבון אחר',
  mfaTotpDesc: 'הזן את הקוד בן 6 הספרות מאפליקציית האימות שלך.',
  mfaPhoneDesc: 'הזן את הקוד ששלחנו אליך זה עתה ב-SMS.',
  mfaEmailDesc: 'הזן את הקוד ששלחנו אליך זה עתה באימייל.',
  mfaBackupDesc: 'הזן אחד מקודי הגיבוי שלך.',

  resetTitle: 'איפוס סיסמה',
  resetRequestDesc: 'הזן את האימייל שלך ונשלח לך קוד איפוס.',
  resetVerifyDesc: 'הזן את הקוד ששלחנו באימייל ובחר סיסמה חדשה.',
  resetSend: 'שליחת קוד איפוס',
  resetSending: 'שולח…',
  resetCodeLabel: 'קוד איפוס',
  newPassword: 'סיסמה חדשה',
  resetSubmit: 'איפוס סיסמה',
  resetSubmitting: 'מאפס…',
  resetBack: 'חזרה להתחברות',

  wrongCredentials: 'אימייל או סיסמה שגויים.',
  accountNotFound: 'לא מצאנו חשבון כזה.',
  passwordPwned: 'הסיסמה הזו הופיעה בדליפת מידע. אנא בחר סיסמה אחרת.',
};

const EN: AuthStrings = {
  welcome: 'Welcome back',
  subtitle: 'Sign in to continue your training',
  email: 'Email',
  emailPlaceholder: 'you@example.com',
  password: 'Password',
  passwordPlaceholder: '••••••••',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  forgot: 'Forgot password?',
  submit: 'Sign in',
  submitting: 'Signing in…',
  invitedFooter: 'New here? Ask your gym to send you an invite link.',

  mfaTitle: 'Verify your account',
  mfaSubtitle: 'One more step to keep your account safe.',
  mfaCodeLabel: 'Verification code',
  mfaCodePlaceholder: '------',
  mfaSubmit: 'Verify',
  mfaSubmitting: 'Verifying…',
  mfaBack: 'Use a different account',
  mfaTotpDesc: 'Enter the 6-digit code from your authenticator app.',
  mfaPhoneDesc: 'Enter the code we just texted you.',
  mfaEmailDesc: 'Enter the code we just emailed you.',
  mfaBackupDesc: 'Enter one of your backup codes.',

  resetTitle: 'Reset your password',
  resetRequestDesc: "Enter your email and we'll send you a reset code.",
  resetVerifyDesc: 'Enter the code we emailed you and choose a new password.',
  resetSend: 'Send reset code',
  resetSending: 'Sending…',
  resetCodeLabel: 'Reset code',
  newPassword: 'New password',
  resetSubmit: 'Reset password',
  resetSubmitting: 'Resetting…',
  resetBack: 'Back to sign in',

  wrongCredentials: 'Incorrect email or password.',
  accountNotFound: "We couldn't find that account.",
  passwordPwned:
    'This password has appeared in a data breach. Please choose a different one.',
};

const RU: AuthStrings = {
  welcome: 'С возвращением',
  subtitle: 'Войдите, чтобы продолжить тренировки',
  email: 'Эл. почта',
  emailPlaceholder: 'you@example.com',
  password: 'Пароль',
  passwordPlaceholder: '••••••••',
  showPassword: 'Показать пароль',
  hidePassword: 'Скрыть пароль',
  forgot: 'Забыли пароль?',
  submit: 'Войти',
  submitting: 'Вход…',
  invitedFooter:
    'Впервые здесь? Попросите зал прислать вам ссылку-приглашение.',

  mfaTitle: 'Подтвердите аккаунт',
  mfaSubtitle: 'Ещё один шаг для защиты вашего аккаунта.',
  mfaCodeLabel: 'Код подтверждения',
  mfaCodePlaceholder: '------',
  mfaSubmit: 'Подтвердить',
  mfaSubmitting: 'Проверяем…',
  mfaBack: 'Использовать другой аккаунт',
  mfaTotpDesc: 'Введите 6-значный код из приложения-аутентификатора.',
  mfaPhoneDesc: 'Введите код из SMS, которое мы только что отправили.',
  mfaEmailDesc: 'Введите код, который мы только что отправили на почту.',
  mfaBackupDesc: 'Введите один из ваших резервных кодов.',

  resetTitle: 'Сброс пароля',
  resetRequestDesc: 'Введите вашу почту, и мы отправим код для сброса.',
  resetVerifyDesc: 'Введите код из письма и выберите новый пароль.',
  resetSend: 'Отправить код',
  resetSending: 'Отправляем…',
  resetCodeLabel: 'Код сброса',
  newPassword: 'Новый пароль',
  resetSubmit: 'Сбросить пароль',
  resetSubmitting: 'Сбрасываем…',
  resetBack: 'Назад ко входу',

  wrongCredentials: 'Неверная почта или пароль.',
  accountNotFound: 'Мы не нашли такой аккаунт.',
  passwordPwned:
    'Этот пароль встречался в утечке данных. Пожалуйста, выберите другой.',
};

export function authStringsFor(lang: Locale): AuthStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}
