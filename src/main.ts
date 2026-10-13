import { loadTranslations } from '@angular/localize';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { provideIonicAngular } from '@ionic/angular/standalone';
import english from './locale/messages.en.json';

const language = localStorage.getItem('adivina.language') === 'en' ? 'en' : 'es';
document.documentElement.lang = language;
document.title = language === 'en' ? 'Guess the Character' : 'Adivina el personaje';
if (language === 'en') loadTranslations(english);

import('./app/app.component').then(({ AppComponent }) =>
  bootstrapApplication(AppComponent, { providers: [provideIonicAngular(), provideHttpClient()] })
).catch(console.error);
