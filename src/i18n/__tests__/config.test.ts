/**
 * Locale resolution: which language the app boots in. A wrong pick here
 * flips the whole UI (and its direction) for every member.
 */
import { isLocale, localeConfig, resolveDeviceLocale } from '../config';

describe('resolveDeviceLocale', () => {
  it('picks the first device language the app ships', () => {
    expect(
      resolveDeviceLocale([
        { languageCode: 'fr' },
        { languageCode: 'ru' },
        { languageCode: 'en' },
      ]),
    ).toBe('ru');
  });

  it('defaults to Hebrew when no device language is supported', () => {
    expect(resolveDeviceLocale([{ languageCode: 'fr' }])).toBe('he');
    expect(resolveDeviceLocale([])).toBe('he');
    expect(resolveDeviceLocale(undefined)).toBe('he');
  });

  it('ignores null language codes without crashing', () => {
    expect(
      resolveDeviceLocale([{ languageCode: null }, { languageCode: 'en' }]),
    ).toBe('en');
  });
});

describe('locale table', () => {
  it('renders Hebrew right-to-left and EN/RU left-to-right', () => {
    expect(localeConfig.he.dir).toBe('rtl');
    expect(localeConfig.en.dir).toBe('ltr');
    expect(localeConfig.ru.dir).toBe('ltr');
  });

  it('recognizes exactly the shipped locales', () => {
    expect(isLocale('he')).toBe(true);
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ru')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    expect(isLocale(null)).toBe(false);
  });
});
