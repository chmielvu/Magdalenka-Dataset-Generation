
import { Component, ChangeDetectionStrategy, signal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GenAiService } from '../../services/gen-ai.service';
import { GeneratedSample } from '../../models/magdalenka.model';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-generate',
  templateUrl: './generate.component.html',
  standalone: true,
  imports: [FormsModule, CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenerateComponent {
  private readonly genAiService = inject(GenAiService);

  readonly prompt = signal<string>("Generate a sample text about economic anxiety, using tactics of 'whataboutism' and expressing 'resentment'.");
  readonly isLoading = signal<boolean>(false);

  // State is simplified to only orchestrator mode
  readonly generatedContent = signal<string>(''); // For streaming
  readonly batchSize = signal<number>(3);
  readonly generatedSamples = signal<GeneratedSample[]>([]);
  readonly analysisResult = signal<string | null>(null);
  readonly isAnalyzing = signal<boolean>(false);

  private resetState() {
    this.generatedContent.set('');
    this.generatedSamples.set([]);
    this.analysisResult.set(null);
  }

  async generate() {
    if (!this.prompt().trim() || this.isLoading()) return;
    this.isLoading.set(true);
    this.resetState();

    try {
      await this.runOrchestratorGeneration();
    } catch (error) {
      this.generatedContent.set('An unexpected error occurred during generation.');
      console.error(error);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async runOrchestratorGeneration() {
    let fullResponse = '';
    const orchestratorPrompt = `Please generate a diverse batch of ${this.batchSize()} samples based on the following theme: "${this.prompt()}". Ensure they cover a range of tactics, emotions, and cleavages from the Magdalenka Codex.`;
    
    const stream = this.genAiService.streamGenerateBatchOrchestrated(orchestratorPrompt, this.batchSize());
    for await (const chunk of stream) {
      fullResponse += chunk;
      this.generatedContent.set(fullResponse); // Update for live streaming
    }
    this.parseAndSetBatch(fullResponse);
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
