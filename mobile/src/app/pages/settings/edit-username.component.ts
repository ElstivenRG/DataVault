import { Component, inject, NO_ERRORS_SCHEMA, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';

@Component({
  selector: 'ns-edit-username', standalone: true,
  imports: [NativeScriptCommonModule, NativeScriptFormsModule, NativeScriptRouterModule],
  schemas: [NO_ERRORS_SCHEMA], templateUrl: './edit-username.component.html'
})
export class EditUsernameComponent {
  private readonly profile = inject(ProfileService);
  private readonly router = inject(Router);
  username = this.profile.username();
  readonly error = signal('');

  load(): void {
    this.profile.reload();
    this.username = this.profile.username();
    this.error.set('');
  }

  save(): void {
    try {
      this.profile.saveUsername(this.username);
      void this.router.navigateByUrl('/settings');
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'No se pudo guardar el nombre.');
    }
  }
}
