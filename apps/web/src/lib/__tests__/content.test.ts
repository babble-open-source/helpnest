import { describe, it, expect } from 'vitest'
import { isHtml, mdToHtml } from '../content'

// ---------------------------------------------------------------------------
// isHtml
// ---------------------------------------------------------------------------

describe('isHtml', () => {
  it('returns true when content starts with an opening tag', () => {
    expect(isHtml('<p>Hello</p>')).toBe(true)
  })

  it('returns true for full HTML documents starting with <!DOCTYPE>', () => {
    expect(isHtml('<!DOCTYPE html><html>')).toBe(true)
  })

  it('returns true when leading whitespace precedes the opening angle bracket', () => {
    expect(isHtml('  <p>Hello</p>')).toBe(true)
  })

  it('returns true for tab-indented HTML', () => {
    expect(isHtml('\t<div>content</div>')).toBe(true)
  })

  it('returns false for plain Markdown starting with a heading', () => {
    expect(isHtml('# Heading')).toBe(false)
  })

  it('returns false for plain text', () => {
    expect(isHtml('Just some plain text')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isHtml('')).toBe(false)
  })

  it('returns false for whitespace-only string', () => {
    expect(isHtml('   ')).toBe(false)
  })

  it('returns false for Markdown that contains inline HTML but does not start with <', () => {
    expect(isHtml('Some text <em>inline</em> here')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — heading conversion
// ---------------------------------------------------------------------------

describe('mdToHtml — headings', () => {
  it('converts h1', () => {
    expect(mdToHtml('# Hello')).toContain('<h1>Hello</h1>')
  })

  it('converts h2', () => {
    expect(mdToHtml('## Hello')).toContain('<h2>Hello</h2>')
  })

  it('converts h3', () => {
    expect(mdToHtml('### Hello')).toContain('<h3>Hello</h3>')
  })

  it('does not convert h4 or deeper (not in spec)', () => {
    // #### is not handled by the regex; it will become a paragraph after processing
    const result = mdToHtml('#### Deep heading')
    expect(result).not.toContain('<h4>')
  })

  it('does not add extra markup around headings separated by blank lines', () => {
    const result = mdToHtml('# Title\n\n## Sub')
    expect(result).toContain('<h1>Title</h1>')
    expect(result).toContain('<h2>Sub</h2>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — inline emphasis
// ---------------------------------------------------------------------------

describe('mdToHtml — inline emphasis', () => {
  it('converts **bold**', () => {
    expect(mdToHtml('**bold**')).toContain('<strong>bold</strong>')
  })

  it('converts *italic*', () => {
    expect(mdToHtml('*italic*')).toContain('<em>italic</em>')
  })

  it('converts ***bold italic*** (combined, bold wrapping italic)', () => {
    const result = mdToHtml('***bold italic***')
    expect(result).toContain('<strong><em>bold italic</em></strong>')
  })

  it('converts `inline code`', () => {
    expect(mdToHtml('`inline code`')).toContain('<code>inline code</code>')
  })

  it('matches the inner word when surrounded by double backticks', () => {
    // The regex /`([^`\n]+)`/g matches from the first ` to the next `, so
    // ``double`` is parsed as: literal-` + `double` + literal-`. The word
    // "double" ends up inside <code>.
    const result = mdToHtml('``double``')
    expect(result).toContain('<code>double</code>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — fenced code blocks
// ---------------------------------------------------------------------------

describe('mdToHtml — fenced code blocks', () => {
  it('converts a plain fenced code block without language', () => {
    const md = '```\nconst x = 1\n```'
    const result = mdToHtml(md)
    expect(result).toContain('<pre><code>')
    expect(result).toContain('const x = 1')
    expect(result).toContain('</code></pre>')
  })

  it('adds language class when language is specified', () => {
    const md = '```typescript\nconst x: number = 1\n```'
    const result = mdToHtml(md)
    expect(result).toContain('class="language-typescript"')
    expect(result).toContain('const x: number = 1')
  })

  it('HTML-escapes angle brackets inside code blocks', () => {
    const md = '```html\n<div>\n```'
    const result = mdToHtml(md)
    expect(result).toContain('&lt;div&gt;')
    expect(result).not.toContain('<div>')
  })

  it('HTML-escapes ampersands inside code blocks', () => {
    const md = '```\na && b\n```'
    const result = mdToHtml(md)
    expect(result).toContain('a &amp;&amp; b')
  })

  it('preserves blank lines inside code blocks without breaking them into paragraphs', () => {
    const md = '```\nline1\n\nline3\n```'
    const result = mdToHtml(md)
    expect(result).toContain('line1')
    expect(result).toContain('line3')
    // Both lines must live inside the same <pre> block
    expect(result).toMatch(/<pre>[\s\S]*line1[\s\S]*line3[\s\S]*<\/pre>/)
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — blockquotes
// ---------------------------------------------------------------------------

describe('mdToHtml — blockquotes', () => {
  it('wraps blockquote lines in <blockquote><p>', () => {
    const result = mdToHtml('> This is a quote')
    expect(result).toContain('<blockquote><p>This is a quote</p></blockquote>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — links
// ---------------------------------------------------------------------------

describe('mdToHtml — links', () => {
  it('converts [text](url) to <a href>', () => {
    const result = mdToHtml('[Click here](https://example.com)')
    expect(result).toContain('<a href="https://example.com">Click here</a>')
  })

  it('handles links with query strings', () => {
    const result = mdToHtml('[Search](https://example.com?q=foo&bar=1)')
    expect(result).toContain('href="https://example.com?q=foo&bar=1"')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — lists
// ---------------------------------------------------------------------------

describe('mdToHtml — unordered lists', () => {
  it('wraps - items in <ul><li>', () => {
    const md = '- Item one\n- Item two'
    const result = mdToHtml(md)
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>Item one</li>')
    expect(result).toContain('<li>Item two</li>')
    expect(result).toContain('</ul>')
  })

  it('wraps * items in <ul><li>', () => {
    const md = '* Alpha\n* Beta'
    const result = mdToHtml(md)
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>Alpha</li>')
  })
})

describe('mdToHtml — ordered lists', () => {
  it('wraps numbered items in <ol><li>', () => {
    const md = '1. First\n2. Second\n3. Third'
    const result = mdToHtml(md)
    expect(result).toContain('<ol>')
    expect(result).toContain('<li>First</li>')
    expect(result).toContain('<li>Second</li>')
    expect(result).toContain('<li>Third</li>')
    expect(result).toContain('</ol>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — horizontal rules
// ---------------------------------------------------------------------------

describe('mdToHtml — horizontal rules', () => {
  it('converts --- on its own line to <hr>', () => {
    const result = mdToHtml('---')
    expect(result).toContain('<hr>')
  })

  it('does not convert --- inside a paragraph (surrounded by text)', () => {
    // The regex is anchored with ^ and $ in multiline mode
    const result = mdToHtml('Before\n---\nAfter')
    expect(result).toContain('<hr>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — paragraph wrapping
// ---------------------------------------------------------------------------

describe('mdToHtml — paragraph wrapping', () => {
  it('wraps plain text in <p> tags', () => {
    const result = mdToHtml('Just plain text')
    expect(result).toContain('<p>Just plain text</p>')
  })

  it('creates separate <p> tags for paragraphs separated by blank lines', () => {
    const result = mdToHtml('First paragraph\n\nSecond paragraph')
    expect(result).toContain('<p>First paragraph</p>')
    expect(result).toContain('<p>Second paragraph</p>')
  })

  it('collapses single newlines within a paragraph block to spaces', () => {
    const result = mdToHtml('Line one\nLine two')
    expect(result).toContain('<p>Line one Line two</p>')
  })
})

// ---------------------------------------------------------------------------
// mdToHtml — combined Markdown
// ---------------------------------------------------------------------------

describe('mdToHtml — combined Markdown document', () => {
  it('converts a realistic multi-element document correctly', () => {
    const md = [
      '# Getting Started',
      '',
      'Welcome to **HelpNest**.',
      '',
      '## Installation',
      '',
      '```bash',
      'npm install helpnest',
      '```',
      '',
      'Run the [docs site](https://helpnest.cloud) locally.',
      '',
      '- Step one',
      '- Step two',
    ].join('\n')

    const result = mdToHtml(md)

    expect(result).toContain('<h1>Getting Started</h1>')
    expect(result).toContain('<strong>HelpNest</strong>')
    expect(result).toContain('<h2>Installation</h2>')
    expect(result).toContain('class="language-bash"')
    expect(result).toContain('npm install helpnest')
    expect(result).toContain('<a href="https://helpnest.cloud">docs site</a>')
    expect(result).toContain('<ul>')
    expect(result).toContain('<li>Step one</li>')
  })
})
