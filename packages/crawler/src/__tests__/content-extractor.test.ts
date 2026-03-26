import { describe, it, expect } from 'vitest'
import { extractContent } from '../content-extractor'

describe('extractContent', () => {
  it('extracts text from a simple HTML body', () => {
    const html = '<html><body><h1>Hello World</h1><p>This is content.</p></body></html>'
    const result = extractContent(html, 'https://example.com')
    expect(result.title).toBe('Hello World')
    expect(result.markdown).toContain('Hello World')
    expect(result.markdown).toContain('This is content.')
  })

  it('uses <title> tag when no h1 exists', () => {
    const html = '<html><head><title>Page Title</title></head><body><p>Content</p></body></html>'
    const result = extractContent(html, 'https://example.com')
    expect(result.title).toBe('Page Title')
  })

  it('strips navigation elements', () => {
    const html = `<html><body>
      <nav><a href="/">Home</a><a href="/about">About</a></nav>
      <main><h1>Article</h1><p>Real content here.</p></main>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).not.toContain('Home')
    expect(result.markdown).not.toContain('About')
    expect(result.markdown).toContain('Real content here.')
  })

  it('strips footer elements', () => {
    const html = `<html><body>
      <main><h1>Article</h1><p>Content.</p></main>
      <footer><p>Copyright 2024</p></footer>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).not.toContain('Copyright')
    expect(result.markdown).toContain('Content.')
  })

  it('strips script and style tags', () => {
    const html = `<html><body>
      <script>alert('hi')</script>
      <style>.x { color: red }</style>
      <h1>Title</h1><p>Content.</p>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).not.toContain('alert')
    expect(result.markdown).not.toContain('color')
    expect(result.markdown).toContain('Content.')
  })

  it('preserves heading hierarchy', () => {
    const html = `<html><body>
      <h1>Main Title</h1>
      <h2>Section One</h2>
      <p>Content one.</p>
      <h2>Section Two</h2>
      <p>Content two.</p>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).toContain('# Main Title')
    expect(result.markdown).toContain('## Section One')
    expect(result.markdown).toContain('## Section Two')
  })

  it('preserves lists', () => {
    const html = `<html><body>
      <h1>Features</h1>
      <ul><li>Feature A</li><li>Feature B</li></ul>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).toContain('Feature A')
    expect(result.markdown).toContain('Feature B')
  })

  it('prefers <main> or <article> tag as content source', () => {
    const html = `<html><body>
      <div class="sidebar"><p>Sidebar junk</p></div>
      <article><h1>Real Article</h1><p>Important stuff.</p></article>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).toContain('Important stuff.')
    expect(result.markdown).not.toContain('Sidebar junk')
  })

  it('truncates content exceeding maxLength', () => {
    const longParagraph = 'A'.repeat(60000)
    const html = `<html><body><h1>Title</h1><p>${longParagraph}</p></body></html>`
    const result = extractContent(html, 'https://example.com', 50000)
    expect(result.markdown.length).toBeLessThanOrEqual(50000)
  })

  it('returns fallback title from URL when no title found', () => {
    const html = '<html><body><p>No title here</p></body></html>'
    const result = extractContent(html, 'https://example.com/my-page')
    expect(result.title).toBe('my-page')
  })

  it('strips iframe elements', () => {
    const html = `<html><body>
      <h1>Page</h1>
      <iframe src="https://ads.example.com"></iframe>
      <p>Content.</p>
    </body></html>`
    const result = extractContent(html, 'https://example.com')
    expect(result.markdown).not.toContain('iframe')
    expect(result.markdown).not.toContain('ads.example.com')
    expect(result.markdown).toContain('Content.')
  })
})
