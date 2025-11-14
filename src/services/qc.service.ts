
import { Injectable, signal, inject } from '@angular/core';
import { GeneratedSample } from '../models/magdalenka.model';
import { GenAiService } from './gen-ai.service';

// The final output schema for a reviewed annotation
export interface BertFinetuneSchema {
  id: string;
  text: string;
  cleavages: number[];
  tactics: string[];
  emotion_fuel: string;
  stance_label: string;
  stance_target: string;
}

// The UI state for a card in the review queue
export interface QcSample {
  id: string;
  text: string;
  // AI suggestions
  suggested_cleavages: Record<string, number>;
  suggested_tactics: Record<string, number>;
  suggested_emotions: Record<string, number>;
  // Human reviewed data
  reviewed_cleavages: Record<string, number>;
  reviewed_tactics: Record<string, string>;
  reviewed_emotion: string;
  reviewed_stance_label: string;
  reviewed_stance_target: string;
  
  status: 'raw' | 'annotating' | 'pending_review' | 'reviewed' | 'rejected' | 'error';
  errorMessage?: string;
}

@Injectable({
  providedIn: 'root',
})
export class QcService {
  private readonly genAi = inject(GenAiService);

  readonly reviewQueue = signal<QcSample[]>([]);
  readonly approvedAnnotations = signal<BertFinetuneSchema[]>([]);
  readonly isAnnotating = signal(false);

  // This hardcoded order MUST match the final training schema definition.
  private readonly CLEAVAGE_ORDER = [
    "cleavage_post_peasant",
    "cleavage_economic_anxiety",
    "cleavage_sovereigntist",
    "cleavage_generational",
    "cleavage_trauma"
  ];

  loadRawData(jsonlContent: string) {
    const lines = jsonlContent.trim().split('\n');
    const newSamples: QcSample[] = [];
    
    for (const line of lines) {
      try {
        if (!line.trim()) continue;
        const raw = JSON.parse(line);
        if (!raw.text && !raw.full_text) continue;

        newSamples.push({
          id: raw.id || `raw-${Date.now()}-${Math.random()}`,
          text: raw.text || raw.full_text || "",
          suggested_cleavages: {},
          suggested_tactics: {},
          suggested_emotions: {},
          reviewed_cleavages: {},
          reviewed_tactics: {},
          reviewed_emotion: 'NEUTRAL', // Default
          reviewed_stance_label: 'NEUTRAL',
          reviewed_stance_target: '',
          status: 'raw'
        });
      } catch (e) {
        console.warn("Skipped invalid JSONL line");
      }
    }
    
    this.reviewQueue.update(q => [...q, ...newSamples]);
  }

  async runAiAnnotation() {
    const rawSamples = this.reviewQueue().filter(s => s.status === 'raw');
    if (rawSamples.length === 0) return;

    this.isAnnotating.set(true);

    const CHUNK_SIZE = 5; // Small batch size for stability
    for (let i = 0; i < rawSamples.length; i += CHUNK_SIZE) {
      const chunk = rawSamples.slice(i, i + CHUNK_SIZE);
      const chunkIds = chunk.map(s => s.id);
      this.updateSampleStatus(chunkIds, 'annotating');

      try {
        const annotations = await this.genAi.annotateBatch(chunk.map(s => ({ id: s.id, text: s.text })));
        
        this.reviewQueue.update(currentQueue => {
          return currentQueue.map(sample => {
            const aiResult = annotations.find(a => a.provenance.generator_id === sample.id);
            if (aiResult) {
              return this.mergeAiAnnotation(sample, aiResult);
            }
            return sample;
          });
        });

      } catch (e) {
        console.error("Batch annotation failed:", e);
        this.reviewQueue.update(q => q.map(s => chunkIds.includes(s.id) ? { ...s, status: 'error', errorMessage: e instanceof Error ? e.message : String(e) } : s));
      }
    }

    this.isAnnotating.set(false);
  }

  private updateSampleStatus(ids: string[], status: QcSample['status'], errorMessage?: string) {
    this.reviewQueue.update(q => q.map(s => ids.includes(s.id) ? { ...s, status, errorMessage } : s));
  }

  private mergeAiAnnotation(sample: QcSample, aiResult: GeneratedSample): QcSample {
    const topEmotion = Object.keys(aiResult.emotions).reduce(
        (a, b) => (aiResult.emotions[a] > aiResult.emotions[b] ? a : b), 
        'NEUTRAL'
    );

    return {
      ...sample,
      suggested_cleavages: aiResult.cleavages,
      suggested_tactics: aiResult.tactics,
      suggested_emotions: aiResult.emotions,
      reviewed_cleavages: { ...aiResult.cleavages },
      reviewed_tactics: Object.fromEntries(
          Object.entries(aiResult.tactics)
          .filter(([_, score]) => score > 0.3)
          .map(([k, v]) => [k, v.toFixed(1)])
      ),
      reviewed_emotion: topEmotion,
      reviewed_stance_label: (aiResult.provenance as any).ai_stance_label || 'NEUTRAL',
      reviewed_stance_target: (aiResult.provenance as any).ai_stance_target || '',
      status: 'pending_review'
    };
  }

  approveSample(approvedSample: QcSample) {
    const finalAnnotation: BertFinetuneSchema = {
      id: approvedSample.id,
      text: approvedSample.text,
      cleavages: this.CLEAVAGE_ORDER.map(key => approvedSample.reviewed_cleavages[key] || 0.0),
      tactics: Object.keys(approvedSample.reviewed_tactics), 
      emotion_fuel: approvedSample.reviewed_emotion,
      stance_label: approvedSample.reviewed_stance_label,
      stance_target: approvedSample.reviewed_stance_target,
    };

    this.approvedAnnotations.update(current => [...current, finalAnnotation]);
    this.reviewQueue.update(current => current.filter(s => s.id !== approvedSample.id));
  }

  bulkApprovePending() {
    const pendingSamples = this.reviewQueue().filter(s => s.status === 'pending_review');
    if (pendingSamples.length === 0) return;

    const newAnnotations = pendingSamples.map(sample => {
      const finalAnnotation: BertFinetuneSchema = {
        id: sample.id,
        text: sample.text,
        cleavages: this.CLEAVAGE_ORDER.map(key => sample.reviewed_cleavages[key] || 0.0),
        tactics: Object.keys(sample.reviewed_tactics),
        emotion_fuel: sample.reviewed_emotion,
        stance_label: sample.reviewed_stance_label,
        stance_target: sample.reviewed_stance_target,
      };
      return finalAnnotation;
    });

    this.approvedAnnotations.update(current => [...current, ...newAnnotations]);
    this.reviewQueue.update(current => current.filter(s => s.status !== 'pending_review'));
  }

  rejectSample(sampleId: string) {
     this.reviewQueue.update(current => current.filter(s => s.id !== sampleId));
  }
  
  exportApprovedAnnotations(): string {
    return this.approvedAnnotations().map(row => JSON.stringify(row)).join('\n');
  }
}
