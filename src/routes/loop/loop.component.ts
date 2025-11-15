
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-loop',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './loop.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoopComponent {}
