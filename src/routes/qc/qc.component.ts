
import { Component, ChangeDetectionStrategy, computed, inject, signal } from '@angular/core';
import { QcService, QcSample } from '../../services/qc.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { QcCardComponent } from './qc-card/qc-card.component';

@Component({
  selector: 'app-qc',
  templateUrl: './qc.component.html',
  imports: [FormsModule, CommonModule, QcCardComponent], 
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QcComponent {
  readonly qcService = inject(QcService);
  
  readonly reviewQueue = this.qcService.reviewQueue;
  readonly approvedAnnotations = this.qcService.approvedAnnotations;
  readonly isAnnotating = this.qcService.isAnnotating;

  readonly rawCount = computed(() => this.reviewQueue().filter(s => s.status === 'raw').length);
  readonly pendingCount = computed(() => this.reviewQueue().filter(s => s.status === 'pending_review').length);
  readonly annotatingCount = computed(() => this.reviewQueue().filter(s => s.status === 'annotating').length);
  readonly errorCount = computed(() => this.reviewQueue().filter(s => s.status === 'error').length);
  
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];
    const text = await file.text();
    this.qcService.loadRawData(text);
    input.value = ''; // Reset file input to allow re-uploading the same file
  }

  runAnnotation() {
    this.qcService.runAiAnnotation();
  }

  onApprove(sample: QcSample) {
    this.qcService.approveSample(sample);
  }

  onBulkApprove() {
    this.qcService.bulkApprovePending();
  }

  onReject(sampleId: string) {
    this.qcService.rejectSample(sampleId);
  }

  onExport() {
    const jsonlData = this.qcService.exportApprovedAnnotations();
    const blob = new Blob([jsonlData], { type: 'application/jsonl' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'annotated_dataset.jsonl';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
