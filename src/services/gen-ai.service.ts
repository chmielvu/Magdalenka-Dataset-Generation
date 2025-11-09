import { Injectable } from '@angular/core';
import { GoogleGenAI, Type, GenerateContentResponse, Tool } from '@google/genai';
import { from } from 'rxjs';
import { Sample, GeneratedSample } from '../models/magdalenka.model';

@Injectable({
  providedIn: 'root',
})
export class GenAiService {
  private readonly ai: GoogleGenAI;
  
  // WARNING: This is for demonstration purposes only in the Applet environment.
  // In a real application, never expose the API key on the client side.
  // The Applet environment will inject the API_KEY.
  private readonly apiKey = process.env.API_KEY;

  constructor() {
    if (!this.apiKey) {
      console.error("API_KEY environment variable not set!");
      // In a real app, you might throw an error or handle this state gracefully
    }
    this.ai = new GoogleGenAI({ apiKey: this.apiKey || 'fallback_key' });
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
    
    const systemInstruction = `You are a sophisticated Polish socio-political analyst and data generation orchestrator. Your task is to generate a batch of nuanced, authentic-sounding text examples reflecting the complex Polish information ecosystem, adhering to the Magdalenka Codex.
- You must generate EXACTLY ${batchSize} unique samples.
- Each sample must conform strictly to the provided JSON schema.
- The 'labels' field is deprecated; use 'cleavages', 'tactics', and 'emotions' objects with key-value pairs for scores.
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
}