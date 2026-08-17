import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SafeImage } from '../components/SafeImage';
import { I18nProvider, useI18n } from '../i18n/I18nProvider';

function LanguageControl() {
  const { language, setLanguage } = useI18n();
  return <button onClick={() => setLanguage(language === 'fr' ? 'ar' : 'fr')}>{language}</button>;
}

describe('Fondations UI', () => {
  it('remplace une image cassée par le visuel JAD HOME', () => {
    render(<SafeImage src="/uploads/products/absente.webp" alt="Produit"/>);
    const image = screen.getByRole('img', { name: 'Produit' });
    fireEvent.error(image);
    expect(image).toHaveAttribute('src', '/jad-home-icon-v3.png');
  });

  it('bascule réellement le document en arabe RTL sans rechargement', () => {
    localStorage.setItem('jad_home_language', 'fr');
    render(<I18nProvider><LanguageControl/></I18nProvider>);
    fireEvent.click(screen.getByRole('button'));
    expect(document.documentElement).toHaveAttribute('lang', 'ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    expect(localStorage.getItem('jad_home_language')).toBe('ar');
  });
});
