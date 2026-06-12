import { Injectable, signal } from '@angular/core';

export type Language = 'en' | 'vi';

@Injectable({
  providedIn: 'root'
})
export class TranslationService {
  currentLang = signal<Language>('vi');
  private translationsData = signal<Record<string, string>>({});
  
  private teamTranslationsEnToVi: Record<string, string> = {};
  private roundTranslationsViToEn: Record<string, string> = {};

  constructor() {
    let initialLang: Language = 'vi';
    if (typeof window !== 'undefined' && window.localStorage) {
      const savedLang = localStorage.getItem('wc_bet_lang') as Language;
      if (savedLang === 'en' || savedLang === 'vi') {
        initialLang = savedLang;
      }
    }
    this.currentLang.set(initialLang);
    this.loadTranslations(initialLang);
  }

  async loadTranslations(lang: Language) {
    try {
      const response = await fetch(`/i18n/${lang}.json`);
      if (!response.ok) {
        throw new Error(`Failed to load translation file: ${response.statusText}`);
      }
      const data = await response.json();
      
      this.translationsData.set(data.ui || {});
      this.teamTranslationsEnToVi = data.teamTranslations || {};
      this.roundTranslationsViToEn = data.roundTranslations || {};
    } catch (error) {
      console.error(`[TranslationService] Error loading translations for ${lang}:`, error);
    }
  }

  setLanguage(lang: Language) {
    this.currentLang.set(lang);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('wc_bet_lang', lang);
    }
    this.loadTranslations(lang);
  }

  toggleLanguage() {
    const nextLang: Language = this.currentLang() === 'vi' ? 'en' : 'vi';
    this.setLanguage(nextLang);
  }

  t(key: string, params?: Record<string, string | number>): string {
    // Access the signal to establish reactivity
    let text = this.translationsData()[key] || key;
    if (params) {
      Object.keys(params).forEach(pKey => {
        text = text.replace(`{${pKey}}`, String(params[pKey]));
      });
    }
    return text;
  }

  /**
   * Translates dynamic database strings (like team names, rounds, times) based on local dictionary.
   */
  translateText(text: string): string {
    if (!text) return '';
    let translated = text;

    // Access the signal to establish reactivity
    this.translationsData();

    if (this.currentLang() === 'vi') {
      // Translate English team names to Vietnamese
      Object.keys(this.teamTranslationsEnToVi).forEach(engKey => {
        const viVal = this.teamTranslationsEnToVi[engKey];
        translated = translated.replace(new RegExp('\\b' + engKey + '\\b', 'g'), viVal);
      });
    } else {
      // Translate Vietnamese rounds/labels to English
      Object.keys(this.roundTranslationsViToEn).forEach(viKey => {
        const engVal = this.roundTranslationsViToEn[viKey];
        translated = translated.replace(new RegExp(viKey, 'g'), engVal);
      });
    }
    return translated;
  }
}
