import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenAiService } from '../../services/gen-ai.service';
import { GeneratedSample } from '../../models/magdalenka.model';

type GenerationMode = 'simple' | 'orchestrator' | 'thinking' | 'search';

@Component({
  selector: 'app-generate',
  templateUrl: './generate.component.html',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateComponent {
  private readonly genAiService = inject(GenAiService);

  readonly mode = signal<GenerationMode>('simple');
  readonly prompt = signal<string>("Generate a sample text about economic anxiety, using tactics of 'whataboutism' and expressing 'resentment'.");
  readonly isLoading = signal<boolean>(false);

  // Simple Mode State
  readonly generatedContent = signal<string>('');
  readonly generatedSample = signal<GeneratedSample | null>(null);

  // Orchestrator Mode State
  readonly batchSize = signal<number>(3);
  readonly generatedSamples = signal<GeneratedSample[]>([]);
  readonly analysisResult = signal<string | null>(null);
  readonly isAnalyzing = signal<boolean>(false);

  // Thinking Mode State
  readonly thinkingResult = signal<string>('');

  // Search Mode State
  readonly searchResult = signal<{ text: string; citations: any[] }>({ text: '', citations: [] });

  setMode(newMode: GenerationMode) {
    this.mode.set(newMode);
    this.resetState();
  }

  private resetState() {
    this.generatedContent.set('');
    this.generatedSample.set(null);
    this.generatedSamples.set([]);
    this.analysisResult.set(null);
    this.thinkingResult.set('');
    this.searchResult.set({ text: '', citations: [] });
  }

  async generate() {
    if (!this.prompt().trim() || this.isLoading()) return;
    this.isLoading.set(true);
    this.resetState();

    try {
      switch (this.mode()) {
        case 'simple':
          await this.runSimpleGeneration();
          break;
        case 'orchestrator':
          await this.runOrchestratorGeneration();
          break;
        case 'thinking':
          await this.runThinkingGeneration();
          break;
        case 'search':
          await this.runSearchGeneration();
          break;
      }
    } catch (error) {
      this.generatedContent.set('An unexpected error occurred during generation.');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async runSimpleGeneration() {
    let fullResponse = '';
    const stream = this.genAiService.streamGenerateSample(this.prompt());
    for await (const chunk of stream) {
      fullResponse += chunk;
      this.generatedContent.set(fullResponse);
    }
    this.parseAndSetSample(fullResponse);
  }

  private async runOrchestratorGeneration() {
    let fullResponse = '';
    const orchestratorPrompt = `Please generate a diverse batch of ${this.batchSize()} samples based on the following theme: "${this.prompt()}". Ensure they cover a range of tactics, emotions, and cleavages from the Magdalenka Codex.`;
    const stream = this.genAiService.streamGenerateBatchOrchestrated(orchestratorPrompt, this.batchSize());
    for await (const chunk of stream) {
      fullResponse += chunk;
      this.generatedContent.set(fullResponse);
    }
    this.parseAndSetBatch(fullResponse);
  }
  
  private async runThinkingGeneration() {
    const result = await this.genAiService.generateWithThinking(this.prompt());
    this.thinkingResult.set(result);
  }

  private async runSearchGeneration() {
    const result = await this.genAiService.generateWithSearch(this.prompt());
    this.searchResult.set(result);
  }

  async analyzeBatch() {
    if (this.isAnalyzing() || this.generatedSamples().length === 0) return;
    this.isAnalyzing.set(true);
    this.analysisResult.set(null);
    try {
      const result = await this.genAiService.analyzeBatchWithCodeExecution(this.generatedSamples());
      this.analysisResult.set(result);
    } catch (error) {
      this.analysisResult.set(`An error occurred during analysis: ${error}`);
      console.error(error);
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  private parseAndSetSample(jsonString: string) {
    try {
      const cleanedJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJsonString) as GeneratedSample;
      this.generatedSample.set(parsed);
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", e);
      this.generatedContent.update(val => val + '\n\n--- [Warning] Could not parse the response as a valid sample. ---');
    }
  }

  private parseAndSetBatch(jsonString: string) {
    try {
      const cleanedJsonString = jsonString.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedJsonString) as { outputs: GeneratedSample[] };
      if (parsed.outputs && Array.isArray(parsed.outputs)) {
        this.generatedSamples.set(parsed.outputs);
      } else {
        throw new Error("Parsed JSON does not contain an 'outputs' array.");
      }
    } catch (e) {
      console.error("Failed to parse AI batch response as JSON:", e);
      this.generatedContent.update(val => val + '\n\n--- [Warning] Could not parse the response as a valid batch. ---');
    }
  }
}