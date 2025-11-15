
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-corpus',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './corpus.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CorpusComponent {}
