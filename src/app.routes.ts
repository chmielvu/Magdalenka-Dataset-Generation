
import { Routes } from '@angular/router';

export const APP_ROUTES: Routes = [
  {
    path: 'corpus',
    loadComponent: () => import('./routes/corpus/corpus.component').then(m => m.CorpusComponent),
    title: 'Corpus Management'
  },
  {
    path: 'generate',
    loadComponent: () => import('./routes/generate/generate.component').then(m => m.GenerateComponent),
    title: 'Codex-Guided Generation'
  },
  {
    path: 'qc',
    loadComponent: () => import('./routes/qc/qc.component').then(m => m.QcComponent),
    title: 'Quality Control'
  },
  {
    path: 'dashboard',
    loadComponent: () => import('./routes/dashboard/dashboard.component').then(m => m.DashboardComponent),
    title: 'Analytics Dashboard'
  },
  {
    path: 'loop',
    loadComponent: () => import('./routes/loop/loop.component').then(m => m.LoopComponent),
    title: 'Agentic Loop'
  },
  {
    path: '',
    redirectTo: 'generate',
    pathMatch: 'full'
  }
];
