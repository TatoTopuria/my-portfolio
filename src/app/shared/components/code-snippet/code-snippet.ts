import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-code-snippet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="min-w-0 overflow-hidden rounded-xl bg-slate-900 shadow-xl">
      <div class="flex items-center gap-2 border-b border-slate-700 px-4 py-3">
        <span class="h-3 w-3 rounded-full bg-red-500"></span>
        <span class="h-3 w-3 rounded-full bg-yellow-500"></span>
        <span class="h-3 w-3 rounded-full bg-green-500"></span>
        <span class="ml-auto font-mono text-xs text-slate-400">{{ language() }}</span>
      </div>
      <pre
        class="overflow-x-auto p-4 font-mono text-sm leading-relaxed text-slate-100"
      ><code>{{ code() }}</code></pre>
    </div>
  `,
})
export class CodeSnippetComponent {
  code = input.required<string>();
  language = input<string>('typescript');
}
