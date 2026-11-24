import './polyfills';
import { provideZonelessChangeDetection } from '@angular/core';
import {
  bootstrapApplication,
  provideNativeScriptHttpClient,
  provideNativeScriptRouter,
  runNativeScriptAngularApp
} from '@nativescript/angular';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';

runNativeScriptAngularApp({
  appModuleBootstrap: () => bootstrapApplication(AppComponent, {
    providers: [
      provideZonelessChangeDetection(),
      provideNativeScriptHttpClient(),
      provideNativeScriptRouter(routes)
    ]
  })
});
