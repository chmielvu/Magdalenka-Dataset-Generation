
import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

interface NavLink {
  path: string;
  label: string;
  icon: string;
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.component.html',
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SidebarComponent {
  readonly navLinks = signal<NavLink[]>([
    { path: '/corpus', label: 'Corpus', icon: 'M19 2H5C3.9 2 3 2.9 3 4V20C3 21.1 3.9 22 5 22H19C20.1 22 21 21.1 21 20V4C21 2.9 20.1 2 19 2ZM14 16H7V14H14V16ZM17 12H7V10H17V12ZM17 8H7V6H17V8Z' },
    { path: '/generate', label: 'Generate', icon: 'M14.06 9.02L12 7.94L9.94 9.02L10.5 6.69L8.69 5.25H11.1L12 2.81L12.9 5.25H15.31L13.5 6.69L14.06 9.02ZM12 21C7.03 21 3 16.97 3 12C3 7.03 7.03 3 12 3C12.47 3 12.92 3.05 13.36 3.14C12.41 4.2 12 5.53 12 7C12 9.39 13.54 11.47 15.68 12.38C15.91 13.54 16 14.76 16 16C16 18.76 14.24 21 12 21Z' },
    { path: '/qc', label: 'QC', icon: 'M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z' },
    { path: '/dashboard', label: 'Dashboard', icon: 'M13 2H11V8H13V2ZM18.5 2.5L17.09 3.91L18.5 8.5L19.91 7.09L18.5 2.5ZM7.5 2.5L6.09 7.09L7.5 8.5L8.91 3.91L7.5 2.5ZM21 12H15V14H21V12ZM9 12H3V14H9V12ZM13 16H11V22H13V16ZM18.5 15.5L17.09 16.91L18.5 21.5L19.91 20.09L18.5 15.5ZM7.5 15.5L6.09 20.09L7.5 21.5L8.91 16.91L7.5 15.5Z' },
    { path: '/loop', label: 'Loop', icon: 'M12 8V4L8 8L12 12V8C15.31 8 18 10.69 18 14C18 17.31 15.31 20 12 20C8.69 20 6 17.31 6 14H4C4 18.42 7.58 22 12 22C16.42 22 20 18.42 20 14C20 9.58 16.42 6 12 6V2L6 8L12 12V8Z' }
  ]);
}
