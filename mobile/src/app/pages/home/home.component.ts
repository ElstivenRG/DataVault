import { AsyncPipe } from '@angular/common';
import { Component, inject, NO_ERRORS_SCHEMA } from '@angular/core';
import { NativeScriptCommonModule } from '@nativescript/angular';
import { ProfileService } from '../../services/profile.service';
import { ReadingStoreService } from '../../store/reading-store.service';
import { removeReading } from '../../store/reading.actions';

@Component({
  selector: 'ns-home', standalone: true,
  imports: [NativeScriptCommonModule, AsyncPipe], schemas: [NO_ERRORS_SCHEMA],
  templateUrl: './home.component.html'
})
export class HomeComponent {
  readonly profile = inject(ProfileService);
  private readonly reading = inject(ReadingStoreService);
  readonly items$ = this.reading.items$;

  remove(id: number): void { this.reading.store.dispatch(removeReading(id)); }
}
