export interface CodexItem {
  id: string;
  name: string;
  description: string;
  examples?: string[];
}

export interface MagdalenkaCodexClassification {
  labels: {
    cleavages: CodexItem[];
    tactics: CodexItem[];
    emotions: CodexItem[];
  }
}

export interface Sample {
  id: string;
  text: string;
  labels?: Record<string, any>; // Optional labels
  provenance: {
    origin: 'human' | 'synthetic';
    [key: string]: any;
  };
}

export interface GeneratedSample {
  text: string;
  tactics: Record<string, number>;
  emotions: Record<string, number>;
  cleavages: Record<string, number>;
  kg: {
    nodes: { id: string; type: string; label?: string; span?: [number, number]; confidence?: number }[];
    edges: { src: string; tgt: string; rel: string; weight?: number }[];
  };
  provenance: {
    origin: 'synthetic';
    generator_id: string;
    reviewer_id?: string | null;
  };
}
