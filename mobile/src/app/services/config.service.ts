import { Injectable } from '@angular/core';
import { ApplicationSettings as AppSettings } from '@nativescript/core';
import { environment } from '../../environments/environment';
import { normalizeApiUrl } from './config-validation';

@Injectable({ providedIn: 'root' })
export class ConfigService {
  get baseUrl(): string {
    return AppSettings.getString('ngrokBaseUrl', environment.ngrokBaseUrl);
  }

  saveBaseUrl(value: string): void {
    AppSettings.setString('ngrokBaseUrl', normalizeApiUrl(value));
  }
}
