// Server-only helpers for the blog.
// Renders markdown to sanitized HTML on the server so the article page can
// SSR the fully rendered content and search engines see it immediately.
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype, { allowDangerousHtml: false })
  .use(rehypeSanitize)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypeHighlight, { detect: true })
  .use(rehypeStringify);

export async function renderMarkdownToHtml(md: string): Promise<string> {
  const file = await processor.process(md);
  return String(file);
}
