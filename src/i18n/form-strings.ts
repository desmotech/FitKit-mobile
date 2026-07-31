/**
 * Forms-flow localization.
 *
 * Covers the user-facing chrome of the My Forms list, the
 * authenticated sign screen, the public token sign screen, the form
 * renderer (submit button + validation messages), and the signature /
 * photo field controls.
 *
 * Form labels and body text are NOT localized here — those come from
 * the API server-side, pre-rendered into the form's own `locale`
 * (he / en / ru). Only the surrounding mobile chrome is translated to
 * the member's UI language.
 *
 * Add a string: extend `FormStrings`, then provide all three locales
 * below. TypeScript will require it.
 */
import { type Locale } from '@/i18n/config';

export interface FormStrings {
  // ── My Forms list ─────────────────────────────────────────────────
  listTitle: string;
  pendingHeader: string;
  completedHeader: string;
  archivedHeader: string;
  emptyTitle: string;
  emptySubtitle: string;
  statusPending: string;
  statusScheduled: string;
  statusSigned: string;
  statusAnswered: string;
  statusReviewed: string;
  statusArchived: string;
  kindCheckIn: string;
  expiresToday: string;
  expiresInDays: (n: number) => string;
  /** Signed-PDF download (FIT-277) — compliance instances only. */
  downloadPdf: string;
  downloadPdfPending: string;
  downloadPdfFailed: string;

  // ── Sign screen chrome (shared by auth + token) ───────────────────
  loadingTitle: string;
  loadingSubtitle: string;
  notFoundTitle: string;
  notFoundSubtitle: string;
  errorTitle: string;
  errorSubtitle: string;
  expiredTitle: string;
  expiredSubtitle: string;
  invalidTitle: string;
  invalidSubtitle: string;
  readyTitle: string;
  readySubtitle: string;
  validationFailed: string;
  signedTitle: string;
  signedSubtitle: string;
  signedAction: string;
  alreadySignedTitle: string;
  alreadySignedSubtitle: string;
  checkinDoneTitle: string;
  checkinDoneSubtitle: string;
  checkinAlreadyTitle: string;
  checkinAlreadySubtitle: string;

  // ── FormRenderer (submit + validation) ────────────────────────────
  submit: string;
  submitCheckIn: string;
  submitting: string;
  uploading: string;
  /** Generic required error — fallback when no per-type message fits. */
  requiredField: string;
  /** Required check, per field type. Specific, actionable copy. */
  requiredText: string;
  requiredFreeText: string;
  requiredCheckboxYesNo: string;
  requiredCheckboxAck: string;
  requiredDate: string;
  requiredNumber: string;
  requiredScale: string;
  requiredMultiChoice: string;
  requiredPhoto: string;
  requiredSignature: string;
  requiredRemaining: (n: number) => string;
  mustBeAtLeast: (n: number) => string;
  mustBeAtMost: (n: number) => string;
  maxLengthExceeded: (n: number) => string;
  idInvalid: string;
  phoneInvalid: string;
  /** Banner shown at the top of the form when there are multiple errors. */
  fixErrors: (n: number) => string;
  uploadFailed: string;

  // ── Signature field ───────────────────────────────────────────────
  sigHint: string;
  sigPlaceholder: string;
  sigClear: string;
  sigSave: string;
  sigSigned: string;
  sigResign: string;
  /** Commit-path failures — previously hardcoded English. */
  sigErrNotReady: string;
  sigErrTimeout: string;
  sigErrBadFile: string;
  sigErrSaveFailed: string;

  // ── Photo field ───────────────────────────────────────────────────
  photoAdd: string;
  photoAddAnother: string;
  photoRemove: string;
}

const HE: FormStrings = {
  listTitle: 'הטפסים שלי',
  pendingHeader: 'ממתינים',
  completedHeader: 'הושלמו',
  archivedHeader: 'בארכיון',
  emptyTitle: 'אין טפסים לחתימה',
  emptySubtitle: 'כשהמועדון ישלח לך טופס, הוא יופיע כאן.',
  statusPending: 'דורש חתימה',
  statusScheduled: 'מתוזמן',
  statusSigned: 'חתום',
  statusAnswered: 'נשלח',
  statusReviewed: 'נסקר',
  statusArchived: 'בארכיון',
  kindCheckIn: "צ'ק-אין",
  expiresToday: 'פג תוקף היום',
  expiresInDays: (n) => (n === 1 ? 'פג תוקף מחר' : `פג תוקף בעוד ${n} ימים`),
  downloadPdf: 'הורדת המסמך',
  downloadPdfPending: 'פותח את המסמך…',
  downloadPdfFailed: 'לא הצלחנו לפתוח את המסמך. נסו שוב.',

  loadingTitle: 'פותח את הטופס…',
  loadingSubtitle: 'רגע — מאמתים את הקישור.',
  notFoundTitle: 'הטופס לא נמצא',
  notFoundSubtitle: 'לא הצלחנו למצוא את הטופס. חזור ונסה שוב.',
  errorTitle: 'משהו השתבש',
  errorSubtitle: 'לא הצלחנו לפתוח את הטופס. בדוק חיבור ונסה שוב.',
  expiredTitle: 'הקישור פג תוקף',
  expiredSubtitle: 'הקישור לחתימה אינו תקף יותר. בקש מהמועדון לשלוח חדש.',
  invalidTitle: 'קישור לא תקין',
  invalidSubtitle: 'הקישור לחתימה אינו תקף. פתח את הקישור העדכני שנשלח אליך.',
  readyTitle: 'מוכן לחתימה',
  readySubtitle: 'מלא את הטופס למטה. התשובות נשלחות באופן מאובטח למועדון.',
  validationFailed: 'חלק מהתשובות אינן עוברות אימות. אנא בדוק את הטופס.',
  signedTitle: 'נחתם — תודה',
  signedSubtitle: 'המועדון קיבל את הטופס החתום שלך.',
  signedAction: 'חזרה לטפסים שלי',
  alreadySignedTitle: 'כבר חתום',
  alreadySignedSubtitle: 'כבר חתמת על הטופס. אין צורך בפעולה נוספת.',
  checkinDoneTitle: 'נשלח — תודה',
  checkinDoneSubtitle: "המאמן שלך יראה את הצ'ק-אין שלך.",
  checkinAlreadyTitle: 'כבר נשלח',
  checkinAlreadySubtitle: "כבר השלמת את הצ'ק-אין הזה.",

  submit: 'שלח וחתום',
  submitCheckIn: 'שליחה',
  submitting: 'שולח…',
  uploading: 'מעלה…',
  requiredField: 'שדה חובה.',
  requiredText: 'נא למלא את השדה.',
  requiredFreeText: 'נא לכתוב תשובה.',
  requiredCheckboxYesNo: 'נא להשיב כן או לא.',
  requiredCheckboxAck: 'יש לאשר כדי להמשיך.',
  requiredDate: 'נא לבחור תאריך.',
  requiredNumber: 'נא להזין מספר.',
  requiredScale: 'נא לסמן ערך בסולם.',
  requiredMultiChoice: 'נא לבחור אפשרות.',
  requiredPhoto: 'נא לצרף תמונה.',
  requiredSignature: 'נא לחתום לפני שליחה.',
  requiredRemaining: (n) =>
    n === 1 ? 'נשאר שדה חובה אחד' : `נשארו ${n} שדות חובה`,
  idInvalid: 'תעודת זהות אינה תקינה',
  phoneInvalid: 'מספר טלפון ישראלי אינו תקין (לדוגמה 050-123-4567)',
  mustBeAtLeast: (n) => `הערך חייב להיות לפחות ${n}.`,
  mustBeAtMost: (n) => `הערך חייב להיות לכל היותר ${n}.`,
  maxLengthExceeded: (n) => `מותר עד ${n} תווים.`,
  fixErrors: (n) =>
    n === 1 ? 'יש לתקן שגיאה אחת בטופס' : `יש לתקן ${n} שגיאות בטופס`,
  uploadFailed: 'ההעלאה נכשלה. נסה שוב.',

  sigHint: 'חתום באצבע בתוך הריבוע.',
  sigPlaceholder: 'חתום כאן',
  sigClear: 'נקה',
  sigSave: 'שמור חתימה',
  sigSigned: 'חתום',
  sigResign: 'חתום מחדש',
  sigErrNotReady: 'משטח החתימה עדיין נטען. נסו שוב.',
  sigErrTimeout: 'שמירת החתימה נמשכה זמן רב מדי. נסו שוב.',
  sigErrBadFile: 'לא ניתן היה לשמור את החתימה. נסו שוב.',
  sigErrSaveFailed: 'השמירה נכשלה. נסו שוב.',

  photoAdd: 'הוסף תמונה',
  photoAddAnother: 'הוסף עוד',
  photoRemove: 'הסר תמונה',
};

const EN: FormStrings = {
  listTitle: 'My Forms',
  pendingHeader: 'Pending',
  completedHeader: 'Completed',
  archivedHeader: 'Archived',
  emptyTitle: 'No forms to sign',
  emptySubtitle: "When your gym sends you a form, it'll show up here.",
  statusPending: 'Needs signature',
  statusScheduled: 'Scheduled',
  statusSigned: 'Signed',
  statusAnswered: 'Submitted',
  statusReviewed: 'Reviewed',
  statusArchived: 'Archived',
  kindCheckIn: 'Check-in',
  expiresToday: 'Expires today',
  expiresInDays: (n) => (n === 1 ? 'Expires tomorrow' : `Expires in ${n} days`),
  downloadPdf: 'Download PDF',
  downloadPdfPending: 'Opening PDF…',
  downloadPdfFailed: "We couldn't open the document. Try again.",

  loadingTitle: 'Opening your form…',
  loadingSubtitle: 'Just a moment — verifying your link.',
  notFoundTitle: 'Form not found',
  notFoundSubtitle: "We couldn't find this form. Pull back and try again.",
  errorTitle: 'Something went wrong',
  errorSubtitle:
    "We couldn't open this form. Check your connection and try again.",
  expiredTitle: 'Link expired',
  expiredSubtitle:
    'This signing link is no longer valid. Ask your gym for a new one.',
  invalidTitle: 'Invalid link',
  invalidSubtitle:
    'The signing link is malformed. Open the latest link sent by your gym.',
  readyTitle: 'Ready to sign',
  readySubtitle:
    'Review and complete the form below. Your answers are sent securely to your gym.',
  validationFailed: "Some answers didn't pass validation. Please review.",
  signedTitle: 'Signed — thank you',
  signedSubtitle: 'Your gym has received your signed form.',
  signedAction: 'Back to My Forms',
  alreadySignedTitle: 'Already signed',
  alreadySignedSubtitle:
    'You already signed this form. No action needed.',
  checkinDoneTitle: 'Submitted — thank you',
  checkinDoneSubtitle: 'Your coach will see your check-in.',
  checkinAlreadyTitle: 'Already submitted',
  checkinAlreadySubtitle: "You've already completed this check-in.",

  submit: 'Submit & sign',
  submitCheckIn: 'Submit',
  submitting: 'Submitting…',
  uploading: 'Uploading…',
  requiredField: 'This field is required.',
  requiredText: 'Please fill in this field.',
  requiredFreeText: 'Please write a response.',
  requiredCheckboxYesNo: 'Please answer yes or no.',
  requiredCheckboxAck: 'You must agree to continue.',
  requiredDate: 'Please pick a date.',
  requiredNumber: 'Please enter a number.',
  requiredScale: 'Please pick a value on the scale.',
  requiredMultiChoice: 'Please pick an option.',
  requiredPhoto: 'Please attach a photo.',
  requiredSignature: 'Please sign before submitting.',
  requiredRemaining: (n) =>
    n === 1 ? '1 required field remaining' : `${n} required fields remaining`,
  idInvalid: 'Invalid ID number',
  phoneInvalid: 'Invalid Israeli phone number (e.g. 050-123-4567)',
  mustBeAtLeast: (n) => `Must be at least ${n}.`,
  mustBeAtMost: (n) => `Must be at most ${n}.`,
  maxLengthExceeded: (n) => `Up to ${n} characters allowed.`,
  fixErrors: (n) =>
    n === 1 ? 'Please fix 1 error in the form' : `Please fix ${n} errors in the form`,
  uploadFailed: 'Upload failed. Please try again.',

  sigHint: 'Sign using your finger inside the box.',
  sigPlaceholder: 'Sign here',
  sigClear: 'Clear',
  sigSave: 'Save signature',
  sigSigned: 'Signed',
  sigResign: 'Re-sign',
  sigErrNotReady: 'The signature pad is still loading. Try again.',
  sigErrTimeout: 'Saving the signature took too long. Try again.',
  sigErrBadFile: 'The signature could not be saved. Try again.',
  sigErrSaveFailed: 'Saving failed. Try again.',

  photoAdd: 'Add photo',
  photoAddAnother: 'Add another',
  photoRemove: 'Remove photo',
};

const RU: FormStrings = {
  listTitle: 'Мои формы',
  pendingHeader: 'Ожидают',
  completedHeader: 'Завершены',
  archivedHeader: 'В архиве',
  emptyTitle: 'Нет форм для подписи',
  emptySubtitle:
    'Когда ваш зал отправит вам форму, она появится здесь.',
  statusPending: 'Требуется подпись',
  statusScheduled: 'Запланировано',
  statusSigned: 'Подписано',
  statusAnswered: 'Отправлено',
  statusReviewed: 'Проверено',
  statusArchived: 'В архиве',
  kindCheckIn: 'Чек-ин',
  expiresToday: 'Истекает сегодня',
  expiresInDays: (n) => (n === 1 ? 'Истекает завтра' : `Истекает через ${n} дн.`),
  downloadPdf: 'Скачать PDF',
  downloadPdfPending: 'Открываем PDF…',
  downloadPdfFailed: 'Не удалось открыть документ. Попробуйте снова.',

  loadingTitle: 'Открываем вашу форму…',
  loadingSubtitle: 'Минутку — проверяем ссылку.',
  notFoundTitle: 'Форма не найдена',
  notFoundSubtitle:
    'Не удалось найти эту форму. Вернитесь назад и попробуйте снова.',
  errorTitle: 'Что-то пошло не так',
  errorSubtitle:
    'Не удалось открыть форму. Проверьте подключение и попробуйте снова.',
  expiredTitle: 'Срок ссылки истёк',
  expiredSubtitle:
    'Эта ссылка для подписи больше недействительна. Попросите зал прислать новую.',
  invalidTitle: 'Неверная ссылка',
  invalidSubtitle:
    'Ссылка для подписи неверна. Откройте последнюю ссылку от вашего зала.',
  readyTitle: 'Готово к подписи',
  readySubtitle:
    'Просмотрите и заполните форму ниже. Ваши ответы безопасно отправляются в зал.',
  validationFailed:
    'Некоторые ответы не прошли проверку. Проверьте форму.',
  signedTitle: 'Подписано — спасибо',
  signedSubtitle: 'Ваш зал получил подписанную форму.',
  signedAction: 'Назад к моим формам',
  alreadySignedTitle: 'Уже подписано',
  alreadySignedSubtitle:
    'Вы уже подписали эту форму. Никаких действий не требуется.',
  checkinDoneTitle: 'Отправлено — спасибо',
  checkinDoneSubtitle: 'Ваш тренер увидит ваш чек-ин.',
  checkinAlreadyTitle: 'Уже отправлено',
  checkinAlreadySubtitle: 'Вы уже прошли этот чек-ин.',

  submit: 'Отправить и подписать',
  submitCheckIn: 'Отправить',
  submitting: 'Отправляется…',
  uploading: 'Загружается…',
  requiredField: 'Обязательное поле.',
  requiredText: 'Пожалуйста, заполните поле.',
  requiredFreeText: 'Пожалуйста, напишите ответ.',
  requiredCheckboxYesNo: 'Пожалуйста, ответьте да или нет.',
  requiredCheckboxAck: 'Подтвердите, чтобы продолжить.',
  requiredDate: 'Пожалуйста, выберите дату.',
  requiredNumber: 'Пожалуйста, введите число.',
  requiredScale: 'Выберите значение на шкале.',
  requiredMultiChoice: 'Выберите вариант.',
  requiredPhoto: 'Прикрепите фото.',
  requiredSignature: 'Подпишите перед отправкой.',
  requiredRemaining: (n) =>
    n === 1
      ? 'Осталось 1 обязательное поле'
      : `Осталось ${n} обязательных полей`,
  idInvalid: 'Неверный номер удостоверения личности',
  phoneInvalid: 'Неверный израильский номер телефона (напр. 050-123-4567)',
  mustBeAtLeast: (n) => `Не менее ${n}.`,
  mustBeAtMost: (n) => `Не более ${n}.`,
  maxLengthExceeded: (n) => `Допускается до ${n} символов.`,
  fixErrors: (n) =>
    n === 1
      ? 'Исправьте 1 ошибку в форме'
      : `Исправьте ${n} ошибок в форме`,
  uploadFailed: 'Загрузка не удалась. Попробуйте снова.',

  sigHint: 'Подпишите пальцем внутри рамки.',
  sigPlaceholder: 'Подпишите здесь',
  sigClear: 'Очистить',
  sigSave: 'Сохранить подпись',
  sigSigned: 'Подписано',
  sigResign: 'Подписать заново',
  sigErrNotReady: 'Поле для подписи ещё загружается. Попробуйте снова.',
  sigErrTimeout: 'Сохранение подписи заняло слишком много времени. Попробуйте снова.',
  sigErrBadFile: 'Не удалось сохранить подпись. Попробуйте снова.',
  sigErrSaveFailed: 'Сохранение не удалось. Попробуйте снова.',

  photoAdd: 'Добавить фото',
  photoAddAnother: 'Добавить ещё',
  photoRemove: 'Удалить фото',
};

export function formStringsFor(lang: Locale): FormStrings {
  switch (lang) {
    case 'he':
      return HE;
    case 'ru':
      return RU;
    default:
      return EN;
  }
}
