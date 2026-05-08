'use client'

interface EditorThemeScopeProps {
  themeCSS: string
  children: React.ReactNode
}

export function EditorThemeScope({ themeCSS, children }: EditorThemeScopeProps) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `.hn-prose-scope { ${themeCSS} }` }} />
      <div className="hn-prose-scope">
        {children}
      </div>
    </>
  )
}
