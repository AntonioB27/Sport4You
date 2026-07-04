import { Component, Input, inject } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ICONS } from '../../constants/icons.constants';

@Component({
  selector: 'app-icon',
  standalone: true,
  imports: [],
  styles: [`:host { display: inline-flex; align-items: center; justify-content: center; line-height: 0; }`],
  template: `<span [innerHTML]="svg" [style.font-size.px]="size" style="display:inline-flex;align-items:center;line-height:0;"></span>`,
})
export class IconComponent {
  private sanitizer = inject(DomSanitizer);
  @Input({ required: true }) name!: string;
  @Input() size: number = 20;
  get svg(): SafeHtml { return this.sanitizer.bypassSecurityTrustHtml(ICONS[this.name] ?? ''); }
}
