
import { Injectable, inject } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse, Tool } from '@google/ai';
import { from } from 'rxjs';
import { Sample, GeneratedSample, MagdalenkaCodexClassification } from '../models/magdalenka.model';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GenAiService {
  private readonly ai: GoogleGenAI;
  
  // WARNING: This is for demonstration purposes only in the Applet environment.
  // In a real application, never expose the API key on the client side.
  // The Applet environment will inject the API_KEY.
  private readonly apiKey = process.env.API_KEY;
  private readonly http = inject(HttpClient);
  private codex: MagdalenkaCodexClassification | null = null;


  constructor() {
    if (!this.apiKey) {
      console.error("API_KEY environment variable not set!");
      // In a real app, you might throw an error or handle this state gracefully
    }
    this.ai = new GoogleGenAI({ apiKey: this.apiKey || 'fallback_key' });
    this.loadCodex();
  }

  private async loadCodex() {
    try {
      // In a real app, ensuring this is loaded before calls is critical.
      // FIXED: Path now correctly points to the assets directory.
      this.codex = await firstValueFrom(this.http.get<MagdalenkaCodexClassification>('assets/Magdalenka Codex Classification.json'));
    } catch (e) {
      console.error("Failed to load Magdalenka Codex. Annotation context will be limited.", e);
    }
  }

  private readonly sampleSchema = {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: 'The generated text content.' },
        tactics: { type: Type.OBJECT, description: 'Object with tactic_id as key and a confidence score (0.0-1.0) as value.'},
        emotions: { type: Type.OBJECT, description: 'Object with emotion_id as key and a confidence score (0.0-1.0) as value.'},
        cleavages: { type: Type.OBJECT, description: 'Object with cleavage_id as key and a confidence score (0.0-1.0) as value.'},
        kg: {
          type: Type.OBJECT,
          properties: {
            nodes: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {id: {type: Type.STRING}, type: {type: Type.STRING}}}},
            edges: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: {src: {type: Type.STRING}, tgt: {type: Type.STRING}, rel: {type: Type.STRING}}}},
          }
        },
        provenance: {
            type: Type.OBJECT,
            properties: {
                origin: {type: Type.STRING, description: "Should always be 'synthetic'"},
                generator_id: {type: Type.STRING, description: "A unique ID for this generation run."},
            }
        }
      },
      required: ['text', 'tactics', 'emotions', 'cleavages', 'kg', 'provenance']
    };

  async *streamGenerateSample(prompt: string): AsyncGenerator<string> {
    if (!this.apiKey) {
       yield "Error: API_KEY is not configured. Please set the API_KEY environment variable.";
       return;
    }

    try {
      const responseStream = await this.ai.models.generateContentStream({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: this.sampleSchema,
        }
      });

      for await (const chunk of responseStream) {
        yield chunk.text;
      }
    } catch (error) {
      console.error('Error during streaming generation:', error);
      yield `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  async *streamGenerateBatchOrchestrated(prompt: string, batchSize: number): AsyncGenerator<string> {
    if (!this.apiKey) {
       yield "Error: API_KEY is not configured.";
       return;
    }

    const batchSchema = {
        type: Type.OBJECT,
        properties: {
            outputs: {
                type: Type.ARRAY,
                description: `An array of exactly ${batchSize} generated samples.`,
                items: this.sampleSchema
            }
        },
        required: ['outputs']
    };
    
    let codexContext = "";
    if (this.codex) {
       codexContext = `
       You must adhere to the Magdalenka Codex for all classifications.
       - Available Cleavages: ${this.codex.labels.cleavages.map(c => c.id).join(', ')}
       - Available Tactics: ${this.codex.labels.tactics.map(t => t.id).join(', ')}
       - Available Emotions: ${this.codex.labels.emotions.map(e => e.id).join(', ')}
       `;
    }

    const systemInstruction = `You are a sophisticated Polish socio-political analyst and data generation orchestrator. Your task is to generate a batch of nuanced, authentic-sounding text examples reflecting the complex Polish information ecosystem, adhering to the Magdalenka Codex.
- You must generate EXACTLY ${batchSize} unique samples.
- Each sample must conform strictly to the provided JSON schema.
- ${codexContext}
- Emulate the style, tone, and complexity of real-world political discourse. Maintain high linguistic quality and doctrinal accuracy.
- Respond ONLY with a single JSON object containing the 'outputs' key, which holds the array of generated samples. Do not include any other text, markdown, or explanations.`;


    try {
        const responseStream = await this.ai.models.generateContentStream({
            model: 'gemini-2.5-pro',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema: batchSchema
            }
        });
        for await (const chunk of responseStream) {
            yield chunk.text;
        }
    } catch (error) {
        console.error('Error during orchestrated batch generation:', error);
        yield `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
    }
  }


  async generateWithThinking(prompt: string): Promise<string> {
    if (!this.apiKey) return "Error: API_KEY not configured.";
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          thinkingConfig: {
            thinkingBudget: 32768, // Max for 2.5 pro
          },
        },
      });
      return response.text;
    } catch (error) {
       console.error('Error during thinking generation:', error);
       return `An error occurred: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
  
  async generateWithSearch(prompt: string): Promise<{text: string; citations: any[]}> {
    if (!this.apiKey) return { text: "Error: API_KEY not configured.", citations: [] };
    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{googleSearch: {}}],
        }
      });
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      return { text: response.text, citations: groundingChunks };
    } catch (error) {
       console.error('Error during search-grounded generation:', error);
       return { text: `An error occurred: ${error instanceof Error ? error.message : String(error)}`, citations: [] };
    }
  }

  async analyzeBatchWithCodeExecution(samples: GeneratedSample[]): Promise<string> {
    if (!this.apiKey) return "Error: API_KEY not configured.";
    if (!samples || samples.length === 0) return "No samples to analyze.";

    const tools: Tool[] = [{ codeExecution: {} }];
    const prompt = `
You are a data analyst assistant that uses a code interpreter to answer questions.
Analyze the following JSON data which contains a list of generated samples.

Data:
\`\`\`json
${JSON.stringify(samples, null, 2)}
\`\`\`

Perform the following analysis using the code interpreter:
1.  Calculate the frequency distribution of all unique tactics that appear across all samples.
2.  Calculate the frequency distribution of the 'emotions' for all samples.
3.  Present the results in a clean, human-readable markdown format with clear headings for each section.
`;

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: prompt,
        config: {
          tools,
        },
      });
      return response.text;
    } catch (error) {
      console.error('Error during code execution analysis:', error);
      return `An error occurred during analysis: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * The "Annotator Agent".
   * Takes a batch of raw text strings and returns their Codex classifications.
   */
  async annotateBatch(rawSamples: {id: string, text: string}[]): Promise<GeneratedSample[]> {
    if (!this.apiKey || rawSamples.length === 0) return [];
    
    if (!this.codex) await this.loadCodex();

    const codexPrompt = `
    CORE DOCTRINE (Magdalenka Codex):
    
    CLEAVAGES (Identify intensity 0.0-1.0):
    ${this.codex?.labels.cleavages.map(c => `- ${c.id}: ${c.description}`).join('\n')}
    
    TACTICS (Identify confidence 0.0-1.0):
    ${this.codex?.labels.tactics.map(t => `- ${t.id}: ${t.description}`).join('\n')}
    
    EMOTIONS (Identify primary emotion):
    ${this.codex?.labels.emotions.map(e => `- ${e.id}: ${e.description}`).join('\n')}
    `;

    const systemInstruction = `
    ROLE: You are the "Magdalenka Annotator Agent". Your sole purpose is to classify Polish political text according to the provided Codex.
    
    ${codexPrompt}
    
    INSTRUCTIONS:
    1. Analyze each provided text sample.
    2. Determine the intensity (0.0 - 1.0) of every Cleavage defined in the Codex.
    3. Identify active Tactics and assign confidence scores.
    4. Identify the primary Emotion Fuel and score it.
    5. **CRITICAL**: Identify the 'stance_label' (AGAINST, FAVOR, NEUTRAL) and the specific 'stance_target' (e.g., "Tusk", "PiS", "UE", "Rolnicy").
    6. Return a JSON object mapping the input ID to its annotation.
    
    STRICT OUTPUT RULES:
    - You MUST return a JSON object.
    - You MUST NOT add conversational text.
    `;

    const userPrompt = `Annotate this batch of ${rawSamples.length} items:\n` + 
                       JSON.stringify(rawSamples, null, 2);

    const annotationSchema = {
      type: Type.OBJECT,
      properties: {
        annotations: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              ref_id: { type: Type.STRING, description: "The ID of the input sample being annotated." },
              tactics: { type: Type.OBJECT, description: "Map of tactic_id (string) to score (number)" },
              emotions: { type: Type.OBJECT, description: "Map of emotion_id (string) to score (number)" },
              cleavages: { type: Type.OBJECT, description: "Map of cleavage_id (string) to score (number)" },
              stance_label: { type: Type.STRING, enum: ["FAVOR", "AGAINST", "NEUTRAL"] },
              stance_target: { type: Type.STRING, description: "The specific entity the stance is directed towards." }
            },
            required: ['ref_id', 'tactics', 'emotions', 'cleavages', 'stance_label', 'stance_target']
          }
        }
      },
      required: ['annotations']
    };

    try {
      const result = await this.ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: userPrompt,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          responseSchema: annotationSchema
        }
      });

      const parsed = JSON.parse(result.text);
      
      return parsed.annotations.map((ann: any) => {
        const original = rawSamples.find(s => s.id === ann.ref_id);
        
        const sample: GeneratedSample = {
          text: original?.text || "Error: Text lost",
          tactics: ann.tactics || {},
          emotions: ann.emotions || {},
          cleavages: ann.cleavages || {},
          kg: { nodes: [], edges: [] }, 
          provenance: { 
            origin: 'synthetic', 
            generator_id: ann.ref_id,
            // Storing stance info here to pass to QC Service
            ai_stance_label: ann.stance_label,
            ai_stance_target: ann.stance_target
          } as any 
        };
        return sample;
      });

    } catch (e) {
      console.error("Annotation batch failed:", e);
      throw e;
    }
  }
}
