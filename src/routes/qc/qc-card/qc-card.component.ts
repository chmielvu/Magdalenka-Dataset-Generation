
import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QcSample } from '../../../services/qc.service';

@Component({
  selector: 'app-qc-card',
  templateUrl: './qc-card.component.html',
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QcCardComponent {
  sample = input.required<QcSample>();
  
  approve = output<QcSample>();
  reject = output<string>();

  // Local state for edits
  editedCleavages = signal<Record<string, number>>({});
  editedTactics = signal<Record<string, string>>({});
  editedEmotion = signal<string>('');
  editedStanceLabel = signal<string>('');
  editedStanceTarget = signal<string>('');

  readonly possibleStances = ['FAVOR', 'AGAINST', 'NEUTRAL'];

  constructor() {
    effect(() => {
      const s = this.sample();
      this.editedCleavages.set({ ...s.reviewed_cleavages });
      this.editedTactics.set({ ...s.reviewed_tactics });
      this.editedEmotion.set(s.reviewed_emotion);
      this.editedStanceLabel.set(s.reviewed_stance_label);
      this.editedStanceTarget.set(s.reviewed_stance_target);
    }, { allowSignalWrites: true });
  }

  get allCleavageKeys(): string[] {
    return [...new Set([...Object.keys(this.sample().suggested_cleavages), ...Object.keys(this.editedCleavages())])].sort();
  }
  get allTacticKeys(): string[] {
    return [...new Set([...Object.keys(this.sample().suggested_tactics), ...Object.keys(this.editedTactics())])].sort();
  }
  get allEmotionKeys(): string[] {
    const keys = new Set(Object.keys(this.sample().suggested_emotions));
    if(this.sample().reviewed_emotion) {
      keys.add(this.sample().reviewed_emotion);
    }
    return Array.from(keys).sort();
  }

  onApprove() {
    const approvedSample: QcSample = {
      ...this.sample(),
      reviewed_cleavages: this.editedCleavages(),
      reviewed_tactics: this.editedTactics(),
      reviewed_emotion: this.editedEmotion(),
      reviewed_stance_label: this.editedStanceLabel(),
      reviewed_stance_target: this.editedStanceTarget(),
      status: 'reviewed',
    };
    this.approve.emit(approvedSample);
  }

  onReject() {
    this.reject.emit(this.sample().id);
  }

  updateCleavage(key: string, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.editedCleavages.update(c => ({ ...c, [key]: value }));
  }

  updateTactic(key: string, event: Event) {
    const value = parseFloat((event.target as HTMLInputElement).value);
    this.editedTactics.update(t => ({ ...t, [key]: value.toFixed(2) }));
  }
}
