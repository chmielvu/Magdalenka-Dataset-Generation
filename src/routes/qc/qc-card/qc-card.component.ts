
import { Component, ChangeDetectionStrategy, input, output, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QcSample } from '../../../services/qc.service';

@Component({
  selector: 'app-qc-card',
  standalone: true,
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
  
  // Expose cleavage keys from the service definition for a stable UI
  readonly cleavageKeys = [
    "cleavage_post_peasant",
    "cleavage_economic_anxiety",
    "cleavage_sovereigntist",
    "cleavage_generational",
    "cleavage_trauma"
  ];

  constructor() {
    effect(() => {
      const s = this.sample();
      // Initialize edited state from the sample's "reviewed" fields
      this.editedCleavages.set({ ...s.reviewed_cleavages });
      this.editedTactics.set({ ...s.reviewed_tactics });
      this.editedEmotion.set(s.reviewed_emotion);
      this.editedStanceLabel.set(s.reviewed_stance_label);
      this.editedStanceTarget.set(s.reviewed_stance_target);
    }, { allowSignalWrites: true });
  }

  get allTacticKeys(): string[] {
    // Combine suggested keys and already edited keys for the UI
    return [...new Set([...Object.keys(this.sample().suggested_tactics), ...Object.keys(this.editedTactics())])].sort();
  }
  get allEmotionKeys(): string[] {
    const keys = new Set(Object.keys(this.sample().suggested_emotions));
    if(this.sample().reviewed_emotion) {
      keys.add(this.sample().reviewed_emotion);
    }
    // Add a "NEUTRAL" fallback
    if (keys.size === 0) keys.add('NEUTRAL');
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
    if (window.confirm('Are you sure you want to reject and discard this sample?')) {
        this.reject.emit(this.sample().id);
    }
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
