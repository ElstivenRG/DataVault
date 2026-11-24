import { Component, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';
import { ConfigService } from '../../services/config.service';

@Component({
  selector: 'ns-settings', standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule],
  schemas: [NO_ERRORS_SCHEMA], templateUrl: './settings.component.html'
})
export class SettingsComponent {
  readonly profile = inject(ProfileService);
  private readonly config = inject(ConfigService);
  baseUrl = this.config.baseUrl;
  readonly error = signal('');
  readonly message = signal('');

  load(): void {
    this.profile.reload();
    this.baseUrl = this.config.baseUrl;
    this.error.set('');
    this.message.set('');
  }

  saveUrl(): void {
    this.error.set('');
    this.message.set('');
    try {
      this.config.saveBaseUrl(this.baseUrl);
      this.baseUrl = this.config.baseUrl;
      this.message.set('URL guardada. La próxima petición usará esta dirección.');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar.');
    }
  }
}
