import { describe, it, expect } from 'vitest';
import { heuristicPlainToMarkdown } from './extensions/plainTextFormatter';

describe('heuristicPlainToMarkdown', () => {
  describe('unicode bullets', () => {
    it('converts • bullet to markdown', () => {
      expect(heuristicPlainToMarkdown('• First item\n• Second item')).toBe(
        '- First item\n- Second item',
      );
    });

    it('converts ◦ and ‣ bullets', () => {
      expect(heuristicPlainToMarkdown('◦ Sub item\n‣ Another')).toBe('- Sub item\n- Another');
    });
  });

  describe('dash bullets', () => {
    it('converts en-dash bullet to markdown', () => {
      expect(heuristicPlainToMarkdown('– First point\n– Second point')).toBe(
        '- First point\n- Second point',
      );
    });

    it('converts em-dash bullet to markdown', () => {
      expect(heuristicPlainToMarkdown('— Point one\n— Point two')).toBe('- Point one\n- Point two');
    });
  });

  describe('numbered list variants', () => {
    it('converts 1) style to 1.', () => {
      expect(heuristicPlainToMarkdown('1) First\n2) Second')).toBe('1. First\n2. Second');
    });

    it('converts 1: style to 1.', () => {
      expect(heuristicPlainToMarkdown('1: First\n2: Second')).toBe('1. First\n2. Second');
    });
  });

  describe('heading detection', () => {
    it('converts isolated short line to h2', () => {
      const input = 'My Title\n\nSome paragraph text follows here.';
      const result = heuristicPlainToMarkdown(input);
      expect(result).toBe('## My Title\n\nSome paragraph text follows here.');
    });

    it('does not convert line with trailing punctuation', () => {
      const input = 'This is a sentence.\n\nAnother paragraph.';
      const result = heuristicPlainToMarkdown(input);
      expect(result).toBe('This is a sentence.\n\nAnother paragraph.');
    });

    it('does not convert long lines', () => {
      const longLine =
        'This is a very long line that exceeds sixty characters and should not be a heading';
      const input = `${longLine}\n\nNext paragraph.`;
      const result = heuristicPlainToMarkdown(input);
      expect(result.startsWith('## ')).toBe(false);
    });

    it('does not convert non-isolated lines', () => {
      const input = 'Title\nImmediately following text';
      const result = heuristicPlainToMarkdown(input);
      expect(result).toBe('Title\nImmediately following text');
    });
  });

  describe('markdown passthrough', () => {
    it('preserves existing markdown headings', () => {
      const input = '# Already a heading\n\nBody text.';
      expect(heuristicPlainToMarkdown(input)).toBe(input);
    });

    it('preserves existing markdown bullets', () => {
      const input = '- Item one\n- Item two';
      expect(heuristicPlainToMarkdown(input)).toBe(input);
    });

    it('preserves existing numbered lists', () => {
      const input = '1. First\n2. Second';
      expect(heuristicPlainToMarkdown(input)).toBe(input);
    });
  });

  describe('blank lines', () => {
    it('preserves blank lines between paragraphs', () => {
      const input = 'Paragraph one.\n\nParagraph two.';
      expect(heuristicPlainToMarkdown(input)).toBe(input);
    });
  });

  describe('mixed content', () => {
    it('handles a realistic mixed paste', () => {
      const input = [
        'Meeting Notes',
        '',
        '• Discussed the roadmap',
        '• Agreed on timeline',
        '',
        'Action Items',
        '',
        '1) Send follow-up email',
        '2) Update the docs',
      ].join('\n');

      const expected = [
        '## Meeting Notes',
        '',
        '- Discussed the roadmap',
        '- Agreed on timeline',
        '',
        '## Action Items',
        '',
        '1. Send follow-up email',
        '2. Update the docs',
      ].join('\n');

      expect(heuristicPlainToMarkdown(input)).toBe(expected);
    });
  });
});
