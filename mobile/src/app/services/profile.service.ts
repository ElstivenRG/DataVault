import { Injectable, signal } from '@angular/core';
import { ApplicationSettings as AppSettings } from '@nativescript/core';
import { normalizeUsername } from './config-validation';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly currentName = signal(AppSettings.getString('username', 'Lector'));
  readonly username = this.currentName.asReadonly();

  reload(): void {
    this.currentName.set(AppSettings.getString('username', 'Lector'));
  }

  saveUsername(value: string): void {
    const name = normalizeUsername(value);
    AppSettings.setString('username', name);
    this.currentName.set(name);
  }
}
